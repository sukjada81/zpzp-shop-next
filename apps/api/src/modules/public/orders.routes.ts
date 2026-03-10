// apps/api/src/modules/public/orders.routes.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireTenant } from "../../common/guard.js";

type SessionLike = {
    user?: {
        id?: string | number;
        loginId?: string;
        name?: string;
        phone?: string;
        cell?: string;
        email?: string;
    };
    member?: {
        uid?: string | number;
        id?: string;
        loginId?: string;
        name?: string;
        phone?: string;
        cell?: string;
        email?: string;
    };
    authUser?: {
        uid?: string | number;
        id?: string;
        loginId?: string;
        name?: string;
        phone?: string;
        cell?: string;
        email?: string;
    };
};

function toId(v: bigint | number | string): string {
    if (typeof v === "bigint") return v.toString();
    return String(v);
}

function toInt(v: unknown, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toUnixNow() {
    return Math.floor(Date.now() / 1000);
}

function unixToIso(v: unknown) {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n) || n <= 0) return null;
    return new Date(n * 1000).toISOString();
}

function normalizePhone(v: unknown) {
    return String(v ?? "").replace(/[^\d]/g, "").trim();
}

function normalizeText(v: unknown) {
    return String(v ?? "").trim();
}

function normalizePlatformType(v: unknown) {
    const s = String(v ?? "").trim().toUpperCase();
    return s || "DAD";
}

function parseDateTimeOrNull(v: unknown) {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

function statusLabel(status: number) {
    switch (status) {
        case 0:
            return "주문접수";
        case 1:
            return "현장결제완료";
        case 2:
            return "픽업준비완료";
        case 4:
            return "픽업완료";
        case 9:
            return "주문취소";
        default:
            return `상태(${status})`;
    }
}

function getCurrentMember(req: any) {
    const session = (req.session ?? {}) as SessionLike;

    const user = session.user ?? session.member ?? session.authUser ?? {};

    const memberUidRaw =
        (user as any).uid ??
        (user as any).memberUid ??
        (user as any).userUid ??
        null;

    const memberUid =
        memberUidRaw == null || memberUidRaw === ""
            ? null
            : String(memberUidRaw);

    const loginId =
        normalizeText(
            (user as any).loginId ??
            (user as any).id ??
            ""
        ) || "";

    const name =
        normalizeText((user as any).name ?? "") || "";

    const phone =
        normalizePhone((user as any).phone ?? (user as any).cell ?? "") || "";

    const email =
        normalizeText((user as any).email ?? "") || "";

    return {
        memberUid,
        loginId,
        name,
        phone,
        email,
    };
}

/**
 * 외부/내부 정책:
 * - 신규 앱 주문은 mallRN_order_info / mallRN_order_goods / mallRN_order_log 사용
 * - platform_type = 'DAD'
 * - PG 없음 / 현장결제
 * - 주문 생성 즉시 실주문(reals=1)
 */
async function generateOrderNum(app: FastifyInstance) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const datePart = `${y}${m}${d}`;

    const prefix = `DAD${datePart}-`;

    const latest = await app.prisma.mallRN_order_info.findFirst({
        where: {
            order_num: {
                startsWith: prefix,
            },
        },
        orderBy: {
            uid: "desc",
        },
        select: {
            order_num: true,
        },
    });

    let nextSeq = 1;

    if (latest?.order_num) {
        const match = String(latest.order_num).match(/-(\d{4,})$/);
        if (match) {
            nextSeq = Number(match[1]) + 1;
        }
    }

    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

function parseOptionInfo(optionInfo: string | null | undefined) {
    const text = String(optionInfo ?? "").trim();
    if (!text) return [] as Array<{
        id: string;
        name: string;
        addPrice: number;
        stockQty: number | null;
    }>;

    const groups = text
        .split("|*|")
        .map((g) => g.trim())
        .filter(Boolean);

    const out: Array<{
        id: string;
        name: string;
        addPrice: number;
        stockQty: number | null;
    }> = [];

    let seq = 0;

    for (const group of groups) {
        const parts = group.split("|");
        const groupName = String(parts[0] ?? "").trim();
        const rawValues = String(parts.slice(1).join("|") ?? "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);

        for (const value of rawValues) {
            const seg = value.split("^").map((x) => x.trim());
            const valueName = String(seg[0] ?? "").trim();
            if (!valueName) continue;

            out.push({
                id: `opt_${seq++}`,
                name: groupName ? `${groupName}:${valueName}` : valueName,
                addPrice: toInt(seg[1], 0),
                stockQty: seg[2] === "" ? null : toInt(seg[2], 0),
            });
        }
    }

    return out;
}

function findOptionSnapshot(
    optionInfo: string | null | undefined,
    optionIndexRaw: unknown,
    optionNameRaw: unknown
) {
    const optionIndex = toInt(optionIndexRaw, 0);
    const optionName = normalizeText(optionNameRaw);

    const parsed = parseOptionInfo(optionInfo);

    if (optionName) {
        const byName = parsed.find((x) => x.name === optionName || x.name.endsWith(`:${optionName}`));
        if (byName) {
            return {
                optionId: optionIndex,
                optionName: byName.name,
                addPrice: byName.addPrice,
                stockQty: byName.stockQty,
            };
        }
    }

    if (optionIndex > 0 && parsed[optionIndex - 1]) {
        const found = parsed[optionIndex - 1];
        return {
            optionId: optionIndex,
            optionName: found.name,
            addPrice: found.addPrice,
            stockQty: found.stockQty,
        };
    }

    return {
        optionId: optionIndex,
        optionName,
        addPrice: 0,
        stockQty: null,
    };
}

function ensureOrderableStatus(row: any) {
    return (
        row &&
        row.deleted_at == null &&
        String(row.status ?? "") === "active" &&
        Number(row.display_use ?? 0) === 1 &&
        Number(row.sale_use ?? 0) === 1 &&
        String(row.auth_ck ?? "Y") === "Y"
    );
}

export async function publicOrderRoutes(app: FastifyInstance) {
    app.addHook("preHandler", requireTenant());

    /**
     * POST /:tenant/v1/orders
     */
    app.post("/v1/orders", async (req: any, reply) => {
        const tenantSlug: string | undefined = req.tenantSlug;
        const tenantId = req.tenantId as bigint;

        const currentMember = getCurrentMember(req);

        const body = z.object({
            buyerName: z.string().min(1).max(50).optional(),
            buyerPhone: z.string().min(8).max(30).optional(),
            receiverName: z.string().min(1).max(50).optional(),
            receiverPhone: z.string().min(8).max(30).optional(),
            pickupAt: z.string().optional().nullable(),
            message: z.string().max(2000).optional().nullable(),
            memo: z.string().max(2000).optional().nullable(),
            direct: z.number().int().min(0).max(1).optional(),
            items: z.array(
                z.object({
                    productId: z.union([z.number(), z.string()]),
                    optionId: z.union([z.number(), z.string()]).optional(),
                    optionName: z.string().optional().nullable(),
                    qty: z.number().int().min(1).max(999),
                })
            ).min(1),
        }).parse(req.body ?? {});

        const buyerName = normalizeText(body.buyerName) || currentMember.name;
        const buyerPhone = normalizePhone(body.buyerPhone) || currentMember.phone;
        const receiverName = normalizeText(body.receiverName) || buyerName;
        const receiverPhone = normalizePhone(body.receiverPhone) || buyerPhone;

        if (!buyerName) {
            return reply.code(400).send({ ok: false, message: "buyerName required" });
        }

        if (!buyerPhone) {
            return reply.code(400).send({ ok: false, message: "buyerPhone required" });
        }

        const pickupAt = parseDateTimeOrNull(body.pickupAt);
        const now = toUnixNow();
        const platformType = "DAD";

        const productIds = Array.from(
            new Set(body.items.map((item) => toInt(item.productId, 0)).filter((x) => x > 0))
        );

        if (!productIds.length) {
            return reply.code(400).send({ ok: false, message: "items required" });
        }

        const products = await app.prisma.mallRN_goods.findMany({
            where: {
                uid: { in: productIds },
                tenant_id: tenantId,
            },
            select: {
                uid: true,
                tenant_id: true,
                vendor: true,
                cate: true,
                name: true,
                goods_code: true,
                price: true,
                orig_price: true,
                qty_type: true,
                qty: true,
                option_use: true,
                option_info: true,
                option_soldout: true,
                display_use: true,
                sale_use: true,
                status: true,
                auth_ck: true,
                deleted_at: true,
            },
        });

        const productMap = new Map(products.map((p: any) => [Number(p.uid), p]));

        for (const item of body.items) {
            const productId = toInt(item.productId, 0);
            const product = productMap.get(productId);

            if (!product) {
                return reply.code(404).send({
                    ok: false,
                    message: `product not found: ${productId}`,
                });
            }

            if (!ensureOrderableStatus(product)) {
                return reply.code(400).send({
                    ok: false,
                    message: `order not allowed: ${productId}`,
                });
            }

            const qty = toInt(item.qty, 0);
            if (qty <= 0) {
                return reply.code(400).send({
                    ok: false,
                    message: `invalid qty: ${productId}`,
                });
            }

            /**
             * 재고 정책
             * - qty_type = 1 : 무제한
             * - qty_type = 0 : 재고 차감 필요
             * - 옵션은 1차에서는 상품 재고 기준으로만 체크
             */
            if (Number(product.qty_type ?? 0) === 0) {
                const stock = toInt(product.qty, 0);
                if (stock < qty) {
                    return reply.code(400).send({
                        ok: false,
                        message: `out of stock: ${productId}`,
                    });
                }
            }
        }

        const orderNum = await generateOrderNum(app);

        const normalizedItems = body.items.map((item) => {
            const productId = toInt(item.productId, 0);
            const product = productMap.get(productId)!;

            const optionSnapshot = findOptionSnapshot(
                String(product.option_info ?? ""),
                item.optionId ?? 0,
                item.optionName ?? ""
            );

            const basePrice = toInt(product.price, 0);
            const finalPrice = basePrice + toInt(optionSnapshot.addPrice, 0);
            const qty = toInt(item.qty, 0);

            return {
                productId,
                tenantId: product.tenant_id as bigint,
                vendor: String(product.vendor ?? ""),
                cate: product.cate as bigint,
                title: String(product.name ?? ""),
                goodsCode: String(product.goods_code ?? ""),
                optionId: optionSnapshot.optionId,
                optionName: optionSnapshot.optionName,
                unitPrice: finalPrice,
                origPrice: toInt(product.orig_price, 0),
                qty,
                lineTotal: finalPrice * qty,
            };
        });

        const payTotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);

        const created = await app.prisma.$transaction(async (tx: any) => {
            const orderInfo = await tx.mallRN_order_info.create({
                data: {
                    id: currentMember.loginId || "",
                    tenant_id: tenantId,
                    member_uid: currentMember.memberUid ? BigInt(currentMember.memberUid) : null,
                    platform_type: platformType,

                    order_num: orderNum,
                    name: buyerName,
                    cell: buyerPhone,
                    email: currentMember.email || "",

                    name2: receiverName,
                    cell2: receiverPhone,
                    postcode: "",
                    address1: "",
                    address2: "",

                    message: normalizeText(body.message),
                    memo: normalizeText(body.memo),

                    passwd: "",
                    pay_total: payTotal,
                    cancel_total: 0,
                    refund_total: 0,
                    delivery_total: 0,

                    pay_type: "B",
                    pay_status: "A",
                    pay_info: "OFFLINE_PICKUP",
                    pay_number: "",
                    escrow: 0,
                    bank_info: "",
                    use_mileage: 0,
                    use_coupon: 0,
                    coupon_uid: 0,
                    cash_receipts: "",
                    mail_send: 0,
                    cash_issued: 0,
                    tax_issued: 0,

                    mobile: "Y",
                    direct: toInt(body.direct, 0) === 1 ? 1 : 0,
                    new: 1,
                    sales_issued: 0,
                    mail_ok: 0,
                    reals: 1,

                    status_date: now,
                    signdate: now,

                    use_td_money: BigInt(0),
                    use_td_point: 0,
                    pay_method: "OFFLINE",

                    pickup_at: pickupAt,
                },
                select: {
                    uid: true,
                    order_num: true,
                },
            });

            const createdGoods: Array<{ uid: number; order_num: string }> = [];

            for (const item of normalizedItems) {
                const row = await tx.mallRN_order_goods.create({
                    data: {
                        vendor: item.vendor,
                        vendor_delivery: "",
                        tenant_id: tenantId,
                        platform_type: platformType,

                        commission: 0,
                        order_num: orderNum,

                        g_uid: item.productId,
                        g_cate: item.cate,
                        g_name: item.title,
                        g_code: item.goodsCode,

                        price: item.unitPrice,
                        orig_price: item.origPrice,
                        qty: item.qty,
                        mileage: 0,

                        option: item.optionId,
                        hotdeal_setting_id: 0,
                        hotdeal_price: 0,
                        option_name: item.optionName,

                        delivery_type: 2,
                        delivery_type_qty: 1,
                        delivery_price: 0,
                        delivery_add_price: 0,
                        delivery_info: "",

                        use_coupon: 0,
                        coupon_uid: 0,
                        discount: 0,
                        discount_info: "",

                        status: 0,
                        status2: 0,
                        status_date: now,
                        reals: 1,
                        signdate: now,
                    },
                    select: {
                        uid: true,
                        order_num: true,
                    },
                });

                createdGoods.push(row);

                const product = productMap.get(item.productId)!;
                if (Number(product.qty_type ?? 0) === 0) {
                    const nextQty = Math.max(0, toInt(product.qty, 0) - item.qty);

                    await tx.mallRN_goods.update({
                        where: { uid: item.productId },
                        data: {
                            qty: nextQty,
                            moddate: now,
                        },
                    });
                }
            }

            for (const row of createdGoods) {
                await tx.mallRN_order_log.create({
                    data: {
                        order_num: row.order_num,
                        og_uid: row.uid,
                        id: currentMember.loginId || "",
                        prev_status: 0,
                        prev_status2: 0,
                        status: 0,
                        status2: 0,
                        signdate: now,
                    },
                });
            }

            return {
                id: orderInfo.uid,
                orderNum: orderInfo.order_num,
            };
        });

        return reply.send({
            ok: true,
            tenant: tenantSlug,
            orderNum: created.orderNum,
            status: 0,
            statusLabel: statusLabel(0),
        });
    });

    /**
     * GET /:tenant/v1/orders/me
     * - 로그인 회원 기준 내 주문목록
     */
    app.get("/v1/orders/me", async (req: any, reply) => {
        const tenantSlug: string | undefined = req.tenantSlug;
        const tenantId = req.tenantId as bigint;
        const currentMember = getCurrentMember(req);

        const q = z.object({
            page: z.coerce.number().min(1).default(1),
            limit: z.coerce.number().min(1).max(50).default(20),
        }).parse(req.query ?? {});

        const where: any = {
            tenant_id: tenantId,
            platform_type: "DAD",
        };

        /**
         * member_uid 우선
         * 없으면 로그인 아이디(id) fallback
         */
        if (currentMember.memberUid) {
            where.member_uid = BigInt(currentMember.memberUid);
        } else if (currentMember.loginId) {
            where.id = currentMember.loginId;
        } else {
            return reply.code(401).send({ ok: false, message: "login required" });
        }

        const skip = (q.page - 1) * q.limit;

        const [total, rows] = await Promise.all([
            app.prisma.mallRN_order_info.count({ where }),
            app.prisma.mallRN_order_info.findMany({
                where,
                orderBy: [{ signdate: "desc" }, { uid: "desc" }],
                skip,
                take: q.limit,
                select: {
                    uid: true,
                    order_num: true,
                    name: true,
                    cell: true,
                    pay_total: true,
                    pickup_at: true,
                    signdate: true,
                    status_date: true,
                },
            }),
        ]);

        const orderNums = rows.map((r: any) => String(r.order_num ?? "")).filter(Boolean);

        const goodsRows =
            orderNums.length > 0
                ? await app.prisma.mallRN_order_goods.findMany({
                    where: {
                        order_num: { in: orderNums },
                        platform_type: "DAD",
                        tenant_id: tenantId,
                    },
                    orderBy: [{ uid: "asc" }],
                    select: {
                        uid: true,
                        order_num: true,
                        g_uid: true,
                        g_name: true,
                        price: true,
                        qty: true,
                        option_name: true,
                        status: true,
                    },
                })
                : [];

        const goodsMap = new Map<string, any[]>();
        for (const row of goodsRows) {
            const key = String(row.order_num ?? "");
            const list = goodsMap.get(key) ?? [];
            list.push(row);
            goodsMap.set(key, list);
        }

        const items = rows.map((row: any) => {
            const orderNum = String(row.order_num ?? "");
            const goods = goodsMap.get(orderNum) ?? [];
            const currentStatus = goods[0] ? Number(goods[0].status ?? 0) : 0;

            return {
                id: String(row.uid),
                orderNum,
                buyerName: row.name ?? "",
                buyerPhone: row.cell ?? "",
                totalAmount: Number(row.pay_total ?? 0),
                pickupAt: row.pickup_at ?? null,
                status: currentStatus,
                statusLabel: statusLabel(currentStatus),
                createdAt: unixToIso(row.signdate),
                items: goods.map((g: any) => ({
                    id: String(g.uid),
                    productId: String(g.g_uid ?? 0),
                    title: g.g_name ?? "",
                    price: Number(g.price ?? 0),
                    qty: Number(g.qty ?? 0),
                    optionName: g.option_name ?? "",
                    status: Number(g.status ?? 0),
                })),
            };
        });

        return reply.send({
            ok: true,
            tenant: tenantSlug,
            total,
            page: q.page,
            limit: q.limit,
            items,
        });
    });

    /**
     * GET /:tenant/v1/orders/:orderNum
     * - 본인 주문상세
     */
    app.get("/v1/orders/:orderNum", async (req: any, reply) => {
        const tenantSlug: string | undefined = req.tenantSlug;
        const tenantId = req.tenantId as bigint;
        const currentMember = getCurrentMember(req);

        const params = z.object({
            orderNum: z.string().min(1),
        }).parse(req.params ?? {});

        const where: any = {
            tenant_id: tenantId,
            platform_type: "DAD",
            order_num: params.orderNum,
        };

        if (currentMember.memberUid) {
            where.member_uid = BigInt(currentMember.memberUid);
        } else if (currentMember.loginId) {
            where.id = currentMember.loginId;
        } else {
            return reply.code(401).send({ ok: false, message: "login required" });
        }

        const info = await app.prisma.mallRN_order_info.findFirst({
            where,
            select: {
                uid: true,
                order_num: true,
                name: true,
                cell: true,
                name2: true,
                cell2: true,
                message: true,
                memo: true,
                pay_total: true,
                cancel_total: true,
                refund_total: true,
                delivery_total: true,
                pay_type: true,
                pay_status: true,
                pickup_at: true,
                signdate: true,
                status_date: true,
            },
        });

        if (!info) {
            return reply.code(404).send({ ok: false, message: "order not found" });
        }

        const goods = await app.prisma.mallRN_order_goods.findMany({
            where: {
                order_num: params.orderNum,
                tenant_id: tenantId,
                platform_type: "DAD",
            },
            orderBy: [{ uid: "asc" }],
            select: {
                uid: true,
                g_uid: true,
                g_name: true,
                g_code: true,
                price: true,
                orig_price: true,
                qty: true,
                option: true,
                option_name: true,
                status: true,
                status2: true,
                signdate: true,
            },
        });

        const currentStatus = goods[0] ? Number(goods[0].status ?? 0) : 0;

        return reply.send({
            ok: true,
            tenant: tenantSlug,
            order: {
                id: String(info.uid),
                orderNum: info.order_num,
                buyerName: info.name ?? "",
                buyerPhone: info.cell ?? "",
                receiverName: info.name2 ?? "",
                receiverPhone: info.cell2 ?? "",
                message: info.message ?? "",
                memo: info.memo ?? "",
                totalAmount: Number(info.pay_total ?? 0),
                cancelTotal: Number(info.cancel_total ?? 0),
                refundTotal: Number(info.refund_total ?? 0),
                deliveryTotal: Number(info.delivery_total ?? 0),
                payType: info.pay_type ?? "B",
                payStatus: info.pay_status ?? "A",
                pickupAt: info.pickup_at ?? null,
                status: currentStatus,
                statusLabel: statusLabel(currentStatus),
                createdAt: unixToIso(info.signdate),
                statusDate: unixToIso(info.status_date),
                items: goods.map((g: any) => ({
                    id: String(g.uid),
                    productId: String(g.g_uid ?? 0),
                    title: g.g_name ?? "",
                    goodsCode: g.g_code ?? "",
                    price: Number(g.price ?? 0),
                    origPrice: Number(g.orig_price ?? 0),
                    qty: Number(g.qty ?? 0),
                    optionId: Number(g.option ?? 0),
                    optionName: g.option_name ?? "",
                    status: Number(g.status ?? 0),
                    status2: Number(g.status2 ?? 0),
                    createdAt: unixToIso(g.signdate),
                })),
            },
        });
    });
}