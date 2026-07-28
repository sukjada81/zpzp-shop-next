/**
 * 셀러 스토어프론트 Toss PG 라우트
 *
 * shop-php 대응:
 *   toss_client_config.php → GET  /v1/payments/toss/client-key
 *   toss_prepare.php       → POST /v1/payments/toss/prepare
 *   toss_confirm.php       → GET  /v1/payments/toss/confirm
 *
 * 결제 흐름:
 *   1. prepare — 금액·상품 서버 검증, mallRN_toss_prepare INSERT (status=0)
 *   2. 프론트 Toss SDK requestPayment → successUrl 로 redirect
 *   3. confirm — Toss /payments/confirm 호출 → 주문 INSERT → prepare status=2
 *   4. 주문 실패 시 Toss 전액 자동취소 (status=7 또는 8)
 *
 * mallRN_toss_prepare.status (shop-php 와 동일):
 *   0=준비, 1=승인완료(주문 전), 2=주문연결완료, 7=자동취소 성공, 8=자동취소 실패, 9=실패
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { captureRefFromRequest } from "../attribution/capture.js";
import {
    buildTossOrderId,
    getTossClientKey,
    getTossSecretKey,
    isValidTossOrderId,
    normalizeTossMethod,
    normalizeTossProvider,
    tossCancelPaymentFull,
    tossCancelSucceeded,
    tossConfirmPayment,
    tossJsonEncode,
} from "../../lib/toss-payment.js";
import {
    createStoreOrder,
    type OrderItemInput,
    validateOrderItems,
} from "./order-create.service.js";
import { listAvailableCoupons, resolveCouponSelection } from "./coupon.service.js";

type TenantContext = {
    tenantId?: bigint | string | number | null;
    tenantSlug?: string;
};

type PrepareBody = {
    /** ★계약(스펙 D5): 할인 전 상품합계. '최종 결제액'이 아니다. 바꾸면 금액 검증이 깨진다. */
    amount?: number;
    /** 사용할 쿠폰(mallRN_coupon.uid). 스택 ON이면 일반 1 + 웰컴 1까지. */
    couponUids?: number[];
    cartId?: string;
    buyerName?: string;
    buyerPhone?: string;
    receiverName?: string;
    receiverPhone?: string;
    pickupAt?: string | null;
    message?: string;
    memo?: string;
    direct?: number;
    items?: OrderItemInput[];
};

type PrepareRoute = {
    Body: PrepareBody;
    Params: { tenant?: string };
};

type ConfirmQuery = {
    paymentKey?: string;
    orderId?: string;
    amount?: string;
};

function toBigIntId(value: unknown): bigint | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "bigint") return value;
    if (typeof value === "number") {
        if (!Number.isFinite(value)) return null;
        return BigInt(Math.trunc(value));
    }
    const text = String(value).trim();
    if (!text) return null;
    try {
        return BigInt(text);
    } catch {
        return null;
    }
}

function toSafeString(value: unknown, fallback = ""): string {
    const text = String(value ?? "").trim();
    return text || fallback;
}

function toInt(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toUnixNow(): number {
    return Math.floor(Date.now() / 1000);
}

function getTenantContext(request: FastifyRequest<PrepareRoute>): {
    tenantId: bigint | null;
    tenantSlug: string;
} {
    const ctx = request as FastifyRequest<PrepareRoute> & TenantContext;
    return {
        tenantId: toBigIntId(ctx.tenantId),
        tenantSlug: toSafeString(ctx.tenantSlug || request.params?.tenant || ""),
    };
}

function getObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object") return null;
    return value as Record<string, unknown>;
}

function readNestedValue(
    source: Record<string, unknown> | null,
    path: string[]
): unknown {
    let current: unknown = source;
    for (const key of path) {
        const obj = getObject(current);
        if (!obj || !(key in obj)) return undefined;
        current = obj[key];
    }
    return current;
}

function extractAuthenticatedMemberUid(request: FastifyRequest): bigint | null {
    const root = getObject(request);
    if (!root) return null;

    const candidates: unknown[] = [
        readNestedValue(root, ["member_uid"]),
        readNestedValue(root, ["memberUid"]),
        readNestedValue(root, ["user", "uid"]),
        readNestedValue(root, ["user", "member_uid"]),
        readNestedValue(root, ["user", "memberUid"]),
        readNestedValue(root, ["member", "uid"]),
        readNestedValue(root, ["member", "member_uid"]),
        readNestedValue(root, ["member", "memberUid"]),
        readNestedValue(root, ["session", "uid"]),
        readNestedValue(root, ["session", "member_uid"]),
        readNestedValue(root, ["session", "memberUid"]),
        readNestedValue(root, ["session", "member", "uid"]),
        readNestedValue(root, ["session", "member", "member_uid"]),
        readNestedValue(root, ["session", "member", "memberUid"]),
        readNestedValue(root, ["session", "user", "uid"]),
        readNestedValue(root, ["session", "user", "member_uid"]),
        readNestedValue(root, ["session", "user", "memberUid"]),
        readNestedValue(root, ["auth", "uid"]),
        readNestedValue(root, ["auth", "member_uid"]),
        readNestedValue(root, ["auth", "memberUid"]),
    ];

    for (const candidate of candidates) {
        const parsed = toBigIntId(candidate);
        if (parsed && parsed > BigInt(0)) return parsed;
    }

    return null;
}

function buildCartId(memberUid: bigint, items: OrderItemInput[]): string {
    const hash = items
        .map((it) => `${it.productId}:${it.qty}:${it.optionId ?? ""}`)
        .join("|");
    return `next-${memberUid}-${hash.slice(0, 40)}`;
}

type StoredPrepareForm = {
    buyerName: string;
    buyerPhone: string;
    receiverName: string;
    receiverPhone: string;
    pickupAt?: string | null;
    message?: string;
    memo?: string;
    direct?: number;
    items: OrderItemInput[];
    couponUids: number[];
    memberUid: string;
    tenantSlug: string;
};

function toCouponUidList(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((v) => toInt(v, 0))
        .filter((v) => v > 0)
        .slice(0, 2);
}

function parsePrepareForm(raw: string | null | undefined): StoredPrepareForm | null {
    if (!raw) return null;
    try {
        const data = JSON.parse(raw) as Partial<StoredPrepareForm>;
        if (!Array.isArray(data.items) || !data.items.length) return null;
        return {
            buyerName: toSafeString(data.buyerName, "주문자"),
            buyerPhone: toSafeString(data.buyerPhone, ""),
            receiverName: toSafeString(data.receiverName, data.buyerName || "수령인"),
            receiverPhone: toSafeString(data.receiverPhone, data.buyerPhone || ""),
            pickupAt: data.pickupAt ?? null,
            message: toSafeString(data.message, ""),
            memo: toSafeString(data.memo, ""),
            direct: toInt(data.direct, 0),
            items: data.items,
            couponUids: toCouponUidList(data.couponUids),
            memberUid: toSafeString(data.memberUid, ""),
            tenantSlug: toSafeString(data.tenantSlug, ""),
        };
    } catch {
        return null;
    }
}

export const publicPaymentRoutes = async (fastify: FastifyInstance) => {
    const prisma = fastify.prisma;

    /** 프론트 Toss SDK 초기화용 — secret key 는 절대 반환하지 않음 */
    fastify.get("/v1/payments/toss/client-key", async (_request, reply: FastifyReply) => {
        const clientKey = getTossClientKey();
        if (!clientKey) {
            return reply.code(503).send({
                ok: false,
                message: "TOSS_CLIENT_KEY 환경변수가 설정되지 않았습니다.",
            });
        }
        return reply.send({ ok: true, clientKey });
    });

    // 주문서 쿠폰 섹션용 — 보유 쿠폰 + 각 쿠폰의 할인액(할인 전 상품합계 기준) + 스택 허용 여부.
    fastify.get<{ Querystring: { subtotal?: string }; Params: { tenant?: string } }>(
        "/v1/coupons/available",
        async (request, reply: FastifyReply) => {
            const memberUid = extractAuthenticatedMemberUid(request);
            if (!memberUid) {
                return reply.code(401).send({ ok: false, msg: "로그인이 필요합니다." });
            }

            const subtotal = toInt(request.query?.subtotal, 0);
            if (subtotal < 0) {
                return reply.code(400).send({ ok: false, msg: "주문금액이 올바르지 않습니다." });
            }

            try {
                const result = await listAvailableCoupons(prisma, memberUid, subtotal);
                return reply.send({ ok: true, ...result });
            } catch (error: unknown) {
                fastify.log.error(error, "COUPON_LIST_ERROR");
                return reply.code(500).send({
                    ok: false,
                    msg: "쿠폰 정보를 불러오지 못했습니다.",
                });
            }
        }
    );

    /**
     * 결제창 열기 전 prepare
     * - 클라이언트 amount 를 DB 상품가로 재검증
     * - form_json 에 주문 폼 전체 저장 (confirm 시 주문 생성에 사용)
     */
    fastify.post<PrepareRoute>("/v1/payments/toss/prepare", async (request, reply: FastifyReply) => {
        try {
            const body = request.body ?? {};
            const { tenantId, tenantSlug } = getTenantContext(request);
            const memberUid = extractAuthenticatedMemberUid(request);

            if (!tenantId) {
                return reply.code(400).send({
                    ok: false,
                    msg: "지점 정보가 올바르지 않습니다.",
                });
            }

            if (!memberUid) {
                return reply.code(401).send({
                    ok: false,
                    msg: "로그인이 필요합니다.",
                });
            }

            const requestedAmount = toInt(body.amount, 0);
            if (requestedAmount <= 0) {
                return reply.code(400).send({ ok: false, msg: "결제금액이 올바르지 않습니다." });
            }

            if (!body.items?.length) {
                return reply.code(400).send({ ok: false, msg: "주문 상품이 없습니다." });
            }

            const validated = await validateOrderItems(prisma, body.items);
            if (!validated.ok) {
                return reply.code(400).send({ ok: false, msg: validated.message });
            }

            if (validated.amount !== requestedAmount) {
                return reply.code(400).send({
                    ok: false,
                    msg: "결제금액이 변경되었습니다. 주문 페이지를 새로고침해 주세요.",
                });
            }

            if (!toSafeString(body.buyerName) || !toSafeString(body.buyerPhone)) {
                return reply.code(400).send({
                    ok: false,
                    msg: "주문자 이름과 연락처를 입력해 주세요.",
                });
            }

            // 쿠폰 적용(W-1). body.amount 는 할인 전 상품합계이므로 위 가드는 그대로 두고,
            // 여기서 할인을 적용해 '실제 승인액'을 만든다. 프론트 선택값은 신뢰하지 않는다.
            const couponUids = toCouponUidList(body.couponUids);
            const selection = await resolveCouponSelection(
                prisma,
                memberUid,
                validated.amount,
                couponUids
            );
            if (!selection.ok) {
                return reply.code(400).send({ ok: false, msg: selection.message });
            }

            const payableAmount = validated.amount - selection.discountTotal;
            if (payableAmount <= 0) {
                return reply.code(400).send({
                    ok: false,
                    msg: "할인 금액이 결제금액과 같거나 커서 결제할 수 없습니다. 쿠폰 선택을 조정해 주세요.",
                });
            }

            const cartId = toSafeString(body.cartId) || buildCartId(memberUid, body.items);
            const orderId = buildTossOrderId();
            const nowTs = toUnixNow();

            const formPayload: StoredPrepareForm = {
                buyerName: toSafeString(body.buyerName, "주문자"),
                buyerPhone: toSafeString(body.buyerPhone, ""),
                receiverName: toSafeString(body.receiverName, body.buyerName || "수령인"),
                receiverPhone: toSafeString(body.receiverPhone, body.buyerPhone || ""),
                pickupAt: body.pickupAt ?? null,
                message: toSafeString(body.message, ""),
                memo: toSafeString(body.memo, ""),
                direct: toInt(body.direct, 0),
                items: body.items,
                couponUids,
                memberUid: memberUid.toString(),
                tenantSlug,
            };

            await prisma.mallRN_toss_prepare.create({
                data: {
                    order_id: orderId,
                    order_num: "",
                    cart_id: cartId,
                    member_id: memberUid.toString(),
                    form_json: tossJsonEncode(formPayload),
                    // 저장값 = 할인 후 실제 승인액. confirm 의 amount 대조가 이 값을 쓴다.
                    amount: payableAmount,
                    payload: tossJsonEncode(body),
                    status: 0,
                    payment_key: "",
                    approved_at: 0,
                    approved_at_ts: 0,
                    payment_status: "",
                    payment_method: "",
                    easy_provider: "",
                    signdate: nowTs,
                },
            });

            return reply.send({
                ok: true,
                orderId,
                // OrderClient 는 이 값을 그대로 requestPayment 청구액으로 쓴다(할인 후 금액).
                amount: payableAmount,
                subtotal: validated.amount,
                discountTotal: selection.discountTotal,
                cart_id: cartId,
                member_id: memberUid.toString(),
            });
        } catch (error: unknown) {
            fastify.log.error(error, "TOSS_PREPARE_ERROR");
            return reply.code(500).send({
                ok: false,
                msg: "결제 준비 중 오류가 발생했습니다.",
            });
        }
    });

    /**
     * Toss successUrl 콜백 — 승인 확정 + 주문 생성
     * 프론트 confirm 페이지가 paymentKey/orderId/amount 쿼리로 호출
     */
    fastify.get(
        "/v1/payments/toss/confirm",
        async (
            request: FastifyRequest<{ Querystring: ConfirmQuery; Params: { tenant?: string } }>,
            reply: FastifyReply
        ) => {
            const secretKey = getTossSecretKey();
            if (!secretKey) {
                return reply.code(500).send({
                    ok: false,
                    message: "결제 설정을 확인할 수 없습니다.",
                    reason: "config",
                });
            }

            const paymentKey = toSafeString(request.query?.paymentKey);
            const orderId = toSafeString(request.query?.orderId);
            const amountRaw = toSafeString(request.query?.amount);

            if (
                !isValidTossOrderId(orderId) ||
                !paymentKey ||
                paymentKey.length > 200 ||
                !/^[1-9][0-9]*$/.test(amountRaw)
            ) {
                return reply.code(400).send({
                    ok: false,
                    message: "결제 승인 정보가 올바르지 않습니다.",
                    reason: "invalid_params",
                });
            }

            const requestAmount = toInt(amountRaw, 0);
            const { tenantId, tenantSlug } = getTenantContext(
                request as unknown as FastifyRequest<PrepareRoute>
            );
            const memberUid = extractAuthenticatedMemberUid(request);

            try {
                const prepare = await prisma.mallRN_toss_prepare.findUnique({
                    where: { order_id: orderId },
                });

                if (!prepare) {
                    return reply.code(404).send({
                        ok: false,
                        message: "결제 준비 정보를 찾을 수 없습니다.",
                        reason: "not_found",
                    });
                }

                // 이미 주문까지 연결된 결제 — 재진입 시 중복 주문 방지
                if (prepare.order_num) {
                    return reply.send({
                        ok: true,
                        orderNum: prepare.order_num,
                        message: "이미 처리된 결제입니다.",
                    });
                }

                if (prepare.amount !== requestAmount) {
                    return reply.code(400).send({
                        ok: false,
                        message: "결제금액이 일치하지 않습니다.",
                        reason: "amount_mismatch",
                    });
                }

                if (prepare.status === 7) {
                    return reply.code(400).send({
                        ok: false,
                        message: "주문 생성에 실패하여 결제가 자동 취소되었습니다.",
                        reason: "auto_cancel_ok",
                    });
                }

                const duplicateCount = await prisma.mallRN_toss_prepare.count({
                    where: {
                        payment_key: paymentKey,
                        uid: { not: prepare.uid },
                        status: { in: [1, 2, 7, 8] },
                    },
                });

                if (duplicateCount > 0) {
                    return reply.code(400).send({
                        ok: false,
                        message: "이미 처리된 결제 정보입니다.",
                        reason: "duplicate",
                    });
                }

                let confirmBody = prepare.confirm_json ?? "";
                let confirmData: Record<string, unknown> = {};

                // status=1/8 이고 confirm_json 이 있으면 Toss 재승인 없이 저장값으로 주문 재개
                if (
                    (prepare.status === 1 || prepare.status === 8) &&
                    prepare.payment_key === paymentKey &&
                    confirmBody
                ) {
                    try {
                        const parsed = JSON.parse(confirmBody);
                        if (parsed && typeof parsed === "object") {
                            confirmData = parsed as Record<string, unknown>;
                        }
                    } catch {
                        confirmData = {};
                    }
                } else {
                    const confirmResult = await tossConfirmPayment(
                        secretKey,
                        paymentKey,
                        orderId,
                        requestAmount
                    );

                    if (
                        confirmResult.httpCode < 200 ||
                        confirmResult.httpCode >= 300 ||
                        confirmResult.curlError
                    ) {
                        await prisma.mallRN_toss_prepare.update({
                            where: { uid: prepare.uid },
                            data: {
                                status: 9,
                                payload: tossJsonEncode({
                                    event: "CONFIRM_FAILED",
                                    httpCode: confirmResult.httpCode,
                                    response: confirmResult.data,
                                    curlError: confirmResult.curlError,
                                }),
                                signdate: toUnixNow(),
                                updated_at: new Date(),
                            },
                        });

                        return reply.code(400).send({
                            ok: false,
                            message: "결제 승인이 완료되지 않았습니다. 다시 시도해 주세요.",
                            reason: "confirm_failed",
                        });
                    }

                    confirmBody = confirmResult.body;
                    confirmData = confirmResult.data;
                }

                const paymentStatus = String(confirmData.status ?? "").toUpperCase();
                const confirmedOrderId = String(confirmData.orderId ?? "");
                const confirmedPaymentKey = String(confirmData.paymentKey ?? "");
                const confirmedAmount = toInt(confirmData.totalAmount, 0);

                if (
                    paymentStatus !== "DONE" ||
                    confirmedOrderId !== orderId ||
                    confirmedPaymentKey !== paymentKey ||
                    confirmedAmount !== requestAmount
                ) {
                    await prisma.mallRN_toss_prepare.update({
                        where: { uid: prepare.uid },
                        data: {
                            status: 9,
                            payload: tossJsonEncode({
                                event: "INVALID_CONFIRM_RESPONSE",
                                response: confirmData,
                            }),
                            signdate: toUnixNow(),
                            updated_at: new Date(),
                        },
                    });

                    return reply.code(400).send({
                        ok: false,
                        message: "결제 승인 결과를 확인할 수 없습니다.",
                        reason: "invalid_confirm",
                    });
                }

                const paymentMethodRaw = String(confirmData.method ?? "");
                const easyPay = confirmData.easyPay;
                const easyProviderRaw =
                    easyPay && typeof easyPay === "object" && !Array.isArray(easyPay)
                        ? String((easyPay as Record<string, unknown>).provider ?? "")
                        : "";
                const paymentMethod = normalizeTossMethod(paymentMethodRaw);
                const easyProvider = normalizeTossProvider(easyProviderRaw);

                let approvedAtTs = Date.parse(String(confirmData.approvedAt ?? ""));
                if (!Number.isFinite(approvedAtTs) || approvedAtTs <= 0) {
                    approvedAtTs = Date.now();
                } else {
                    approvedAtTs = Math.floor(approvedAtTs / 1000) * 1000;
                }
                const approvedAtUnix = Math.floor(approvedAtTs / 1000);

                if (prepare.status !== 1 && prepare.status !== 8) {
                    await prisma.mallRN_toss_prepare.update({
                        where: { uid: prepare.uid },
                        data: {
                            payment_key: paymentKey,
                            approved_at: approvedAtUnix,
                            approved_at_ts: approvedAtUnix,
                            payload: confirmBody,
                            confirm_json: confirmBody,
                            payment_status: "DONE",
                            payment_method: paymentMethod,
                            easy_provider: easyProvider,
                            status: 1,
                            signdate: toUnixNow(),
                            updated_at: new Date(),
                        },
                    });
                }

                let orderNum = prepare.order_num;

                if (!orderNum && prepare.status !== 8) {
                    const form = parsePrepareForm(prepare.form_json);
                    if (!form) {
                        return reply.code(500).send({
                            ok: false,
                            message: "주문 정보를 복원할 수 없습니다.",
                            reason: "form_invalid",
                        });
                    }

                    const formMemberUid = toBigIntId(form.memberUid);
                    if (!memberUid || !formMemberUid || memberUid !== formMemberUid) {
                        return reply.code(403).send({
                            ok: false,
                            message: "로그인 정보가 일치하지 않습니다.",
                            reason: "member_mismatch",
                        });
                    }

                    if (!tenantId) {
                        return reply.code(400).send({
                            ok: false,
                            message: "지점 정보가 올바르지 않습니다.",
                            reason: "invalid_tenant",
                        });
                    }

                    await captureRefFromRequest(
                        prisma,
                        Number(memberUid),
                        (request as any).cookies ?? {}
                    );

                    const created = await createStoreOrder(prisma, {
                        tenantId,
                        tenantSlug: tenantSlug || form.tenantSlug,
                        memberUid,
                        buyerName: form.buyerName,
                        buyerPhone: form.buyerPhone,
                        receiverName: form.receiverName,
                        receiverPhone: form.receiverPhone,
                        pickupAt: form.pickupAt,
                        message: form.message,
                        memo: form.memo,
                        direct: form.direct,
                        items: form.items,
                        couponUids: form.couponUids,
                        payment: {
                            paymentKey,
                            tossOrderId: orderId,
                            method: paymentMethod,
                            provider: easyProvider,
                            approvedAtTs: approvedAtUnix,
                            amount: requestAmount,
                        },
                    });

                    if (!created.ok) {
                        // 승인은 됐지만 주문 INSERT 실패 → PG 전액 자동취소 (shop-php toss_confirm.php 동일)
                        const cancelResult = await tossCancelPaymentFull(
                            secretKey,
                            paymentKey,
                            orderId,
                            "결제 승인 후 주문 생성 실패 자동 취소"
                        );
                        const cancelOk = tossCancelSucceeded(cancelResult);

                        await prisma.mallRN_toss_prepare.update({
                            where: { uid: prepare.uid },
                            data: {
                                status: cancelOk ? 7 : 8,
                                payment_status: cancelOk ? "CANCELED" : "DONE",
                                payload: tossJsonEncode({
                                    event: "ORDER_CREATE_FAILED",
                                    orderError: created.message,
                                    autoCancel: {
                                        succeeded: cancelOk,
                                        httpCode: cancelResult.httpCode,
                                    },
                                }),
                                signdate: toUnixNow(),
                                updated_at: new Date(),
                            },
                        });

                        return reply.code(cancelOk ? 400 : 500).send({
                            ok: false,
                            message: cancelOk
                                ? "주문 생성에 실패하여 결제가 자동 취소되었습니다."
                                : "결제는 승인되었지만 주문 처리에 실패했습니다. 고객센터에 문의해 주세요.",
                            reason: cancelOk ? "auto_cancel_ok" : "auto_cancel_fail",
                        });
                    }

                    orderNum = created.orderNum;

                    await prisma.mallRN_toss_prepare.update({
                        where: { uid: prepare.uid },
                        data: {
                            status: 2,
                            order_num: orderNum,
                            signdate: toUnixNow(),
                            updated_at: new Date(),
                        },
                    });
                }

                return reply.send({
                    ok: true,
                    orderNum,
                    message: "주문이 완료되었습니다.",
                });
            } catch (error: unknown) {
                fastify.log.error(error, "TOSS_CONFIRM_ERROR");
                return reply.code(500).send({
                    ok: false,
                    message: "결제 확인 중 오류가 발생했습니다.",
                    reason: "server_error",
                });
            }
        }
    );
};
