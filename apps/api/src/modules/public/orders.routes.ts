// apps/api/src/modules/public/orders.routes.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireTenant } from "../../common/guard.js";

type SessionLike = {
    user?: {
        uid?: string | number;
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

const PLATFORM_TYPE = "DAD";
const CATE_DAILY_DEAL = BigInt(100000);
const CATE_PICKUP_READY = BigInt(100001);

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
        case 3:
            return "픽업예정";
        case 4:
            return "픽업완료";
        case 8:
            return "미수령";
        case 9:
            return "주문취소";
        default:
            return `상태(${status})`;
    }
}

function formatShortKoreanDate(value?: Date | string | null) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dayKor = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()] ?? "";
    return `${mm}/${dd}(${dayKor})`;
}

function formatPickupRange(start?: Date | string | null, end?: Date | string | null) {
    const s = formatShortKoreanDate(start);
    const e = formatShortKoreanDate(end);
    if (s && e) return `${s} ~ ${e}`;
    return s || e || "";
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

    const name = normalizeText((user as any).name ?? "") || "";
    const phone = normalizePhone((user as any).phone ?? (user as any).cell ?? "") || "";
    const email = normalizeText((user as any).email ?? "") || "";

    return {
        memberUid,
        loginId,
        name,
        phone,
        email,
    };
}

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
    if (!text) {
        return [] as Array<{
            id: string;
            name: string;
            addPrice: number;
            stockQty: number | null;
        }>;
    }

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

function buildOrderDisplay(input: {
    status: number;
    pickupAt?: Date | string | null;
    goods: Array<{ g_cate?: bigint | number | string | null }>;
}) {
    const now = new Date();
    const pickupAt = input.pickupAt ? new Date(input.pickupAt) : null;
    const hasPickupAt = pickupAt && !Number.isNaN(pickupAt.getTime());

    const isPickupReadyGoods = input.goods.some(
        (g) => String(g.g_cate ?? "") === String(CATE_PICKUP_READY)
    );
    const isTodayDealGoods = input.goods.some(
        (g) => String(g.g_cate ?? "") === String(CATE_DAILY_DEAL)
    );

    if (input.status === 9) {
        return {
            displayStatus: "주문취소",
            badgeText: null,
            footerText: "주문이 취소되었습니다.",
            canCancel: false,
        };
    }

    if (input.status === 4) {
        return {
            displayStatus: "픽업완료",
            badgeText: null,
            footerText: "수령 완료",
            canCancel: false,
        };
    }

    if (isPickupReadyGoods) {
        return {
            displayStatus: "바로픽업가능",
            badgeText: null,
            footerText: "매장 방문 시 수령 가능",
            canCancel: true,
        };
    }

    if (hasPickupAt) {
        const pickupDate = pickupAt as Date;
        const pickupWindowEnd = new Date(pickupDate.getTime() + 2 * 24 * 60 * 60 * 1000);

        if (now.getTime() < pickupDate.getTime()) {
            return {
                displayStatus: isTodayDealGoods ? "오늘의공구" : statusLabel(input.status),
                badgeText: `픽업 예정 · ${formatShortKoreanDate(pickupDate)}`,
                footerText: `입고 예정일: ${formatShortKoreanDate(pickupDate)}`,
                canCancel: true,
            };
        }

        if (now.getTime() <= pickupWindowEnd.getTime()) {
            return {
                displayStatus: "픽업기간",
                badgeText: `픽업 기간 · ${formatPickupRange(pickupDate, pickupWindowEnd)}`,
                footerText: "매장 방문 후 수령해 주세요",
                canCancel: true,
            };
        }

        return {
            displayStatus: "미수령",
            badgeText: null,
            footerText: "미수령",
            canCancel: false,
        };
    }

    return {
        displayStatus: statusLabel(input.status),
        badgeText: null,
        footerText: "주문이 접수되었습니다.",
        canCancel: true,
    };
}

function buildOrderItemPayload(row: any) {
    return {
        id: String(row.uid),
        productId: String(row.g_uid ?? 0),
        title: row.g_name ?? "",
        price: Number(row.price ?? 0),
        qty: Number(row.qty ?? 0),
        optionName: row.option_name ?? "",
        status: Number(row.status ?? 0),
    };
}

function buildOrderGoodsDetailPayload(row: any) {
    return {
        id: String(row.uid),
        productId: String(row.g_uid ?? 0),
        title: row.g_name ?? "",
        goodsCode: row.g_code ?? "",
        price: Number(row.price ?? 0),
        origPrice: Number(row.orig_price ?? 0),
        qty: Number(row.qty ?? 0),
        optionId: Number(row.option ?? 0),
        optionName: row.option_name ?? "",
        status: Number(row.status ?? 0),
        status2: Number(row.status2 ?? 0),
        createdAt: unixToIso(row.signdate),
    };
}

function orderMatchesPhone(info: { cell?: string | null; cell2?: string | null }, phone: string) {
    const normalized = normalizePhone(phone);
    if (!normalized) return false;
    return normalizePhone(info.cell) === normalized || normalizePhone(info.cell2) === normalized;
}

async function fetchGuestOrdersByPhoneAndOrderNums(app: FastifyInstance, tenantId: bigint, phone: string, orderNums: string[]) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || !orderNums.length) return [];

    const rows = await app.prisma.mallRN_order_info.findMany({
        where: {
            tenant_id: tenantId,
            platform_type: PLATFORM_TYPE,
            order_num: { in: orderNums },
            OR: [
                { cell: normalizedPhone },
                { cell2: normalizedPhone },
            ],
        },
        orderBy: [{ signdate: "desc" }, { uid: "desc" }],
        select: {
            uid: true,
            order_num: true,
            name: true,
            cell: true,
            cell2: true,
            pay_total: true,
            pickup_at: true,
            signdate: true,
            status_date: true,
        },
    });

    const matchedOrderNums = rows.map((r: any) => String(r.order_num ?? "")).filter(Boolean);

    const goodsRows =
        matchedOrderNums.length > 0
            ? await app.prisma.mallRN_order_goods.findMany({
                where: {
                    order_num: { in: matchedOrderNums },
                    tenant_id: tenantId,
                    platform_type: PLATFORM_TYPE,
                },
                orderBy: [{ uid: "asc" }],
                select: {
                    uid: true,
                    order_num: true,
                    g_uid: true,
                    g_cate: true,
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

    return rows.map((row: any) => {
        const orderNum = String(row.order_num ?? "");
        const goods = goodsMap.get(orderNum) ?? [];
        const currentStatus = goods[0] ? Number(goods[0].status ?? 0) : 0;
        const display = buildOrderDisplay({
            status: currentStatus,
            pickupAt: row.pickup_at,
            goods,
        });

        return {
            id: String(row.uid),
            orderNum,
            buyerName: row.name ?? "",
            buyerPhone: row.cell ?? "",
            totalAmount: Number(row.pay_total ?? 0),
            pickupAt: row.pickup_at ?? null,
            status: currentStatus,
            statusLabel: statusLabel(currentStatus),
            displayStatus: display.displayStatus,
            badgeText: display.badgeText,
            footerText: display.footerText,
            canCancel: display.canCancel,
            createdAt: unixToIso(row.signdate),
            items: goods.map(buildOrderItemPayload),
        };
    });
}

export async function publicOrderRoutes(app: FastifyInstance) {
    app.addHook("preHandler", requireTenant());

    app.post("/v1/orders", async (req: any, reply) => {
        const tenantSlug: string | undefined = req.tenantSlug;
        const tenantId = req.tenantId as bigint;
        const currentMember = getCurrentMember(req);

        const body = z
            .object({
                buyerName: z.string().min(1).max(50).optional(),
                buyerPhone: z.string().min(8).max(30).optional(),
                receiverName: z.string().min(1).max(50).optional(),
                receiverPhone: z.string().min(8).max(30).optional(),
                pickupAt: z.string().optional().nullable(),
                message: z.string().max(2000).optional().nullable(),
                memo: z.string().max(2000).optional().nullable(),
                direct: z.number().int().min(0).max(1).optional(),
                items: z
                    .array(
                        z.object({
                            productId: z.union([z.number(), z.string()]),
                            optionId: z.union([z.number(), z.string()]).optional(),
                            optionName: z.string().optional().nullable(),
                            qty: z.number().int().min(1).max(999),
                        })
                    )
                    .min(1),
            })
            .parse(req.body ?? {});

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
                    platform_type: PLATFORM_TYPE,

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
                        platform_type: PLATFORM_TYPE,

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

    app.get("/v1/orders/me", async (req: any, reply) => {
        const tenantSlug: string | undefined = req.tenantSlug;
        const tenantId = req.tenantId as bigint;
        const currentMember = getCurrentMember(req);

        const q = z
            .object({
                page: z.coerce.number().min(1).default(1),
                limit: z.coerce.number().min(1).max(50).default(20),
            })
            .parse(req.query ?? {});

        const where: any = {
            tenant_id: tenantId,
            platform_type: PLATFORM_TYPE,
        };

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
                        platform_type: PLATFORM_TYPE,
                        tenant_id: tenantId,
                    },
                    orderBy: [{ uid: "asc" }],
                    select: {
                        uid: true,
                        order_num: true,
                        g_uid: true,
                        g_cate: true,
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
            const display = buildOrderDisplay({
                status: currentStatus,
                pickupAt: row.pickup_at,
                goods,
            });

            return {
                id: String(row.uid),
                orderNum,
                buyerName: row.name ?? "",
                buyerPhone: row.cell ?? "",
                totalAmount: Number(row.pay_total ?? 0),
                pickupAt: row.pickup_at ?? null,
                status: currentStatus,
                statusLabel: statusLabel(currentStatus),
                displayStatus: display.displayStatus,
                badgeText: display.badgeText,
                footerText: display.footerText,
                canCancel: display.canCancel,
                createdAt: unixToIso(row.signdate),
                items: goods.map(buildOrderItemPayload),
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

    app.post("/v1/orders/guest/list", async (req: any, reply) => {
        const tenantSlug: string | undefined = req.tenantSlug;
        const tenantId = req.tenantId as bigint;

        const body = z
            .object({
                phone: z.string().min(8).max(30),
                orderNums: z.array(z.string().min(1)).min(1).max(50),
            })
            .parse(req.body ?? {});

        const items = await fetchGuestOrdersByPhoneAndOrderNums(
            app,
            tenantId,
            body.phone,
            body.orderNums
        );

        return reply.send({
            ok: true,
            tenant: tenantSlug,
            items,
        });
    });

    app.get("/v1/orders/guest/:orderNum", async (req: any, reply) => {
        const tenantSlug: string | undefined = req.tenantSlug;
        const tenantId = req.tenantId as bigint;

        const params = z
            .object({
                orderNum: z.string().min(1),
            })
            .parse(req.params ?? {});

        const query = z
            .object({
                phone: z.string().min(8).max(30),
            })
            .parse(req.query ?? {});

        const info = await app.prisma.mallRN_order_info.findFirst({
            where: {
                tenant_id: tenantId,
                platform_type: PLATFORM_TYPE,
                order_num: params.orderNum,
            },
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

        if (!orderMatchesPhone(info, query.phone)) {
            return reply.code(403).send({ ok: false, message: "phone mismatch" });
        }

        const goods = await app.prisma.mallRN_order_goods.findMany({
            where: {
                order_num: params.orderNum,
                tenant_id: tenantId,
                platform_type: PLATFORM_TYPE,
            },
            orderBy: [{ uid: "asc" }],
            select: {
                uid: true,
                g_uid: true,
                g_cate: true,
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
        const display = buildOrderDisplay({
            status: currentStatus,
            pickupAt: info.pickup_at,
            goods,
        });

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
                displayStatus: display.displayStatus,
                badgeText: display.badgeText,
                footerText: display.footerText,
                canCancel: display.canCancel,
                createdAt: unixToIso(info.signdate),
                statusDate: unixToIso(info.status_date),
                items: goods.map(buildOrderGoodsDetailPayload),
            },
        });
    });

    app.get("/v1/orders/:orderNum", async (req: any, reply) => {
        const tenantSlug: string | undefined = req.tenantSlug;
        const tenantId = req.tenantId as bigint;
        const currentMember = getCurrentMember(req);

        const params = z
            .object({
                orderNum: z.string().min(1),
            })
            .parse(req.params ?? {});

        const where: any = {
            tenant_id: tenantId,
            platform_type: PLATFORM_TYPE,
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
                platform_type: PLATFORM_TYPE,
            },
            orderBy: [{ uid: "asc" }],
            select: {
                uid: true,
                g_uid: true,
                g_cate: true,
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
        const display = buildOrderDisplay({
            status: currentStatus,
            pickupAt: info.pickup_at,
            goods,
        });

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
                displayStatus: display.displayStatus,
                badgeText: display.badgeText,
                footerText: display.footerText,
                canCancel: display.canCancel,
                createdAt: unixToIso(info.signdate),
                statusDate: unixToIso(info.status_date),
                items: goods.map(buildOrderGoodsDetailPayload),
            },
        });
    });

    app.post("/v1/orders/guest/:orderNum/cancel", async (req: any, reply) => {
        const tenantSlug: string | undefined = req.tenantSlug;
        const tenantId = req.tenantId as bigint;

        const params = z
            .object({
                orderNum: z.string().min(1),
            })
            .parse(req.params ?? {});

        const body = z
            .object({
                phone: z.string().min(8).max(30),
            })
            .parse(req.body ?? {});

        const info = await app.prisma.mallRN_order_info.findFirst({
            where: {
                tenant_id: tenantId,
                platform_type: PLATFORM_TYPE,
                order_num: params.orderNum,
            },
            select: {
                uid: true,
                order_num: true,
                pay_total: true,
                cell: true,
                cell2: true,
            },
        });

        if (!info) {
            return reply.code(404).send({ ok: false, message: "order not found" });
        }

        if (!orderMatchesPhone(info, body.phone)) {
            return reply.code(403).send({ ok: false, message: "phone mismatch" });
        }

        const goods = await app.prisma.mallRN_order_goods.findMany({
            where: {
                order_num: params.orderNum,
                tenant_id: tenantId,
                platform_type: PLATFORM_TYPE,
            },
            select: {
                uid: true,
                g_uid: true,
                qty: true,
                status: true,
            },
        });

        if (!goods.length) {
            return reply.code(404).send({ ok: false, message: "order goods not found" });
        }

        if (goods.some((g: any) => Number(g.status ?? 0) === 4)) {
            return reply.code(400).send({
                ok: false,
                message: "already picked up",
            });
        }

        if (goods.every((g: any) => Number(g.status ?? 0) === 9)) {
            return reply.code(400).send({
                ok: false,
                message: "already cancelled",
            });
        }

        const now = toUnixNow();
        const productIds = goods.map((g: any) => Number(g.g_uid)).filter((v: number) => v > 0);

        const productRows =
            productIds.length > 0
                ? await app.prisma.mallRN_goods.findMany({
                    where: { uid: { in: productIds } },
                    select: {
                        uid: true,
                        qty: true,
                        qty_type: true,
                    },
                })
                : [];

        const productMap = new Map(productRows.map((p: any) => [Number(p.uid), p]));

        await app.prisma.$transaction(async (tx: any) => {
            await tx.mallRN_order_info.update({
                where: { uid: info.uid },
                data: {
                    cancel_total: Number(info.pay_total ?? 0),
                    status_date: now,
                },
            });

            await tx.mallRN_order_goods.updateMany({
                where: {
                    order_num: params.orderNum,
                    tenant_id: tenantId,
                    platform_type: PLATFORM_TYPE,
                },
                data: {
                    status: 9,
                    status2: 1,
                    status_date: now,
                },
            });

            for (const row of goods) {
                await tx.mallRN_order_log.create({
                    data: {
                        order_num: params.orderNum,
                        og_uid: Number(row.uid),
                        id: "guest",
                        prev_status: Number(row.status ?? 0),
                        prev_status2: 0,
                        status: 9,
                        status2: 1,
                        signdate: now,
                    },
                });

                const product = productMap.get(Number(row.g_uid));
                if (product && Number(product.qty_type ?? 0) === 0) {
                    await tx.mallRN_goods.update({
                        where: { uid: Number(row.g_uid) },
                        data: {
                            qty: Number(product.qty ?? 0) + Number(row.qty ?? 0),
                            moddate: now,
                        },
                    });
                }
            }
        });

        return reply.send({
            ok: true,
            tenant: tenantSlug,
            orderNum: params.orderNum,
            status: 9,
            statusLabel: statusLabel(9),
        });
    });

    app.post("/v1/orders/:orderNum/cancel", async (req: any, reply) => {
        const tenantSlug: string | undefined = req.tenantSlug;
        const tenantId = req.tenantId as bigint;
        const currentMember = getCurrentMember(req);

        const params = z
            .object({
                orderNum: z.string().min(1),
            })
            .parse(req.params ?? {});

        const where: any = {
            tenant_id: tenantId,
            platform_type: PLATFORM_TYPE,
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
                pay_total: true,
            },
        });

        if (!info) {
            return reply.code(404).send({ ok: false, message: "order not found" });
        }

        const goods = await app.prisma.mallRN_order_goods.findMany({
            where: {
                order_num: params.orderNum,
                tenant_id: tenantId,
                platform_type: PLATFORM_TYPE,
            },
            select: {
                uid: true,
                g_uid: true,
                qty: true,
                status: true,
            },
        });

        if (!goods.length) {
            return reply.code(404).send({ ok: false, message: "order goods not found" });
        }

        if (goods.some((g: any) => Number(g.status ?? 0) === 4)) {
            return reply.code(400).send({
                ok: false,
                message: "already picked up",
            });
        }

        if (goods.every((g: any) => Number(g.status ?? 0) === 9)) {
            return reply.code(400).send({
                ok: false,
                message: "already cancelled",
            });
        }

        const now = toUnixNow();
        const productIds = goods.map((g: any) => Number(g.g_uid)).filter((v: number) => v > 0);

        const productRows =
            productIds.length > 0
                ? await app.prisma.mallRN_goods.findMany({
                    where: { uid: { in: productIds } },
                    select: {
                        uid: true,
                        qty: true,
                        qty_type: true,
                    },
                })
                : [];

        const productMap = new Map(productRows.map((p: any) => [Number(p.uid), p]));

        await app.prisma.$transaction(async (tx: any) => {
            await tx.mallRN_order_info.update({
                where: { uid: info.uid },
                data: {
                    cancel_total: Number(info.pay_total ?? 0),
                    status_date: now,
                },
            });

            await tx.mallRN_order_goods.updateMany({
                where: {
                    order_num: params.orderNum,
                    tenant_id: tenantId,
                    platform_type: PLATFORM_TYPE,
                },
                data: {
                    status: 9,
                    status2: 1,
                    status_date: now,
                },
            });

            for (const row of goods) {
                await tx.mallRN_order_log.create({
                    data: {
                        order_num: params.orderNum,
                        og_uid: Number(row.uid),
                        id: currentMember.loginId || "",
                        prev_status: Number(row.status ?? 0),
                        prev_status2: 0,
                        status: 9,
                        status2: 1,
                        signdate: now,
                    },
                });

                const product = productMap.get(Number(row.g_uid));
                if (product && Number(product.qty_type ?? 0) === 0) {
                    await tx.mallRN_goods.update({
                        where: { uid: Number(row.g_uid) },
                        data: {
                            qty: Number(product.qty ?? 0) + Number(row.qty ?? 0),
                            moddate: now,
                        },
                    });
                }
            }
        });

        return reply.send({
            ok: true,
            tenant: tenantSlug,
            orderNum: params.orderNum,
            status: 9,
            statusLabel: statusLabel(9),
        });
    });
}