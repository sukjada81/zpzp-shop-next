// apps/api/src/modules/seller/orders.routes.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireTenant } from "../../common/guard.js";

type SellerSessionLike = {
    seller?: {
        id?: string | number;
        uid?: string | number;
        loginId?: string;
        name?: string;
        tenantId?: string | number;
        tenant_id?: string | number;
    };
    admin?: {
        id?: string | number;
        uid?: string | number;
        loginId?: string;
        name?: string;
        isSuperAdmin?: boolean;
        tenantId?: string | number;
        tenant_id?: string | number;
    };
};

const PLATFORM_TYPE = "DAD";

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

function normalizeText(v: unknown) {
    return String(v ?? "").trim();
}

function formatDateTimeText(value?: unknown) {
    const iso = unixToIso(value);
    if (!iso) return "-";

    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
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

function getCurrentActor(req: any) {
    const session = (req.session ?? {}) as SellerSessionLike;
    const seller = session.seller;
    const admin = session.admin;

    if (seller) {
        return {
            ok: true,
            actorId: normalizeText(seller.loginId ?? seller.id ?? seller.uid ?? "seller"),
            actorName: normalizeText(seller.name ?? "seller"),
            actorType: "seller" as const,
            tenantId:
                seller.tenantId != null
                    ? BigInt(String(seller.tenantId))
                    : seller.tenant_id != null
                        ? BigInt(String(seller.tenant_id))
                        : null,
        };
    }

    if (admin) {
        return {
            ok: true,
            actorId: normalizeText(admin.loginId ?? admin.id ?? admin.uid ?? "admin"),
            actorName: normalizeText(admin.name ?? "admin"),
            actorType: "admin" as const,
            tenantId:
                admin.tenantId != null
                    ? BigInt(String(admin.tenantId))
                    : admin.tenant_id != null
                        ? BigInt(String(admin.tenant_id))
                        : null,
        };
    }

    return {
        ok: false,
        actorId: "",
        actorName: "",
        actorType: "guest" as const,
        tenantId: null,
    };
}

function buildOrderSummary(goods: any[]) {
    if (!goods.length) return "";

    const first = goods[0];
    const firstName = normalizeText(first?.g_name);
    if (!firstName) return "";

    if (goods.length === 1) {
        const qty = toInt(first?.qty, 0);
        const optionName = normalizeText(first?.option_name);
        if (optionName && qty > 0) return `${firstName} / ${optionName} × ${qty}`;
        if (optionName) return `${firstName} / ${optionName}`;
        if (qty > 0) return `${firstName} × ${qty}`;
        return firstName;
    }

    return `${firstName} 외 ${goods.length - 1}건`;
}

function buildOrderListItem(info: any, goods: any[]) {
    const currentStatus = goods[0] ? Number(goods[0].status ?? 0) : 0;

    return {
        id: String(info.uid),
        orderNo: String(info.order_num ?? ""),
        buyerName: info.name ?? "",
        amount: Number(info.pay_total ?? 0),
        status: currentStatus,
        statusLabel: statusLabel(currentStatus),
        createdAt: unixToIso(info.signdate),
        createdAtText: formatDateTimeText(info.signdate),
        phone: info.cell ?? "",
        memo: info.memo ?? "",
        address: [info.address1 ?? "", info.address2 ?? ""].filter(Boolean).join(" ").trim(),
        itemSummary: buildOrderSummary(goods),
        items: goods.map((row: any) => ({
            id: String(row.uid),
            productId: String(row.g_uid ?? 0),
            productName: row.g_name ?? "",
            goodsName: row.g_name ?? "",
            optionName: row.option_name ?? "",
            quantity: Number(row.qty ?? 0),
            qty: Number(row.qty ?? 0),
            price: Number(row.price ?? 0),
            status: Number(row.status ?? 0),
        })),
    };
}

function buildOrderDetailItem(info: any, goods: any[]) {
    const currentStatus = goods[0] ? Number(goods[0].status ?? 0) : 0;

    return {
        id: String(info.uid),
        orderNo: String(info.order_num ?? ""),
        buyerName: info.name ?? "",
        amount: Number(info.pay_total ?? 0),
        status: currentStatus,
        statusLabel: statusLabel(currentStatus),
        createdAt: unixToIso(info.signdate),
        createdAtText: formatDateTimeText(info.signdate),
        phone: info.cell ?? "",
        memo: info.memo ?? "",
        address: [info.address1 ?? "", info.address2 ?? ""].filter(Boolean).join(" ").trim(),
        message: info.message ?? "",
        receiverName: info.name2 ?? "",
        receiverPhone: info.cell2 ?? "",
        items: goods.map((row: any) => ({
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
        })),
    };
}

export async function sellerOrderRoutes(app: FastifyInstance) {
    app.addHook("preHandler", requireTenant());

    app.get("/v1/seller/orders", async (req: any, reply) => {
        const tenantSlug: string | undefined = req.tenantSlug;
        const tenantId = req.tenantId as bigint;
        const actor = getCurrentActor(req);

        if (!actor.ok) {
            return reply.code(401).send({ ok: false, message: "seller login required" });
        }

        const q = z
            .object({
                page: z.coerce.number().min(1).default(1),
                limit: z.coerce.number().min(1).max(100).default(50),
                query: z.string().optional(),
            })
            .parse(req.query ?? {});

        const skip = (q.page - 1) * q.limit;

        const where: any = {
            tenant_id: tenantId,
            platform_type: PLATFORM_TYPE,
        };

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
                    name2: true,
                    cell2: true,
                    address1: true,
                    address2: true,
                    memo: true,
                    message: true,
                    pay_total: true,
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
                        tenant_id: tenantId,
                        platform_type: PLATFORM_TYPE,
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

        let items = rows.map((row: any) => {
            const orderNum = String(row.order_num ?? "");
            const goods = goodsMap.get(orderNum) ?? [];
            return buildOrderListItem(row, goods);
        });

        const searchText = normalizeText(q.query).toLowerCase();
        if (searchText) {
            items = items.filter((item) => {
                const itemNames = Array.isArray(item.items)
                    ? item.items
                        .map((x: any) =>
                            [x.productName ?? "", x.optionName ?? ""].filter(Boolean).join(" ")
                        )
                        .join(" ")
                        .toLowerCase()
                    : "";

                return (
                    String(item.orderNo ?? "").toLowerCase().includes(searchText) ||
                    String(item.buyerName ?? "").toLowerCase().includes(searchText) ||
                    String(item.statusLabel ?? "").toLowerCase().includes(searchText) ||
                    String(item.itemSummary ?? "").toLowerCase().includes(searchText) ||
                    itemNames.includes(searchText)
                );
            });
        }

        return reply.send({
            ok: true,
            tenant: tenantSlug,
            total,
            page: q.page,
            limit: q.limit,
            items,
        });
    });

    app.get("/v1/seller/orders/:id", async (req: any, reply) => {
        const tenantSlug: string | undefined = req.tenantSlug;
        const tenantId = req.tenantId as bigint;
        const actor = getCurrentActor(req);

        if (!actor.ok) {
            return reply.code(401).send({ ok: false, message: "seller login required" });
        }

        const params = z
            .object({
                id: z.string().min(1),
            })
            .parse(req.params ?? {});

        const uid = toInt(params.id, 0);
        if (uid <= 0) {
            return reply.code(400).send({ ok: false, message: "invalid order id" });
        }

        const info = await app.prisma.mallRN_order_info.findFirst({
            where: {
                uid,
                tenant_id: tenantId,
                platform_type: PLATFORM_TYPE,
            },
            select: {
                uid: true,
                order_num: true,
                name: true,
                cell: true,
                name2: true,
                cell2: true,
                address1: true,
                address2: true,
                memo: true,
                message: true,
                pay_total: true,
                signdate: true,
                status_date: true,
            },
        });

        if (!info) {
            return reply.code(404).send({ ok: false, message: "order not found" });
        }

        const goods = await app.prisma.mallRN_order_goods.findMany({
            where: {
                order_num: String(info.order_num ?? ""),
                tenant_id: tenantId,
                platform_type: PLATFORM_TYPE,
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

        return reply.send({
            ok: true,
            tenant: tenantSlug,
            item: buildOrderDetailItem(info, goods),
        });
    });

    app.patch("/v1/seller/orders/:id/status", async (req: any, reply) => {
        const tenantSlug: string | undefined = req.tenantSlug;
        const tenantId = req.tenantId as bigint;
        const actor = getCurrentActor(req);

        if (!actor.ok) {
            return reply.code(401).send({ ok: false, message: "seller login required" });
        }

        const params = z
            .object({
                id: z.string().min(1),
            })
            .parse(req.params ?? {});

        const body = z
            .object({
                status: z.number().int(),
            })
            .parse(req.body ?? {});

        const uid = toInt(params.id, 0);
        if (uid <= 0) {
            return reply.code(400).send({ ok: false, message: "invalid order id" });
        }

        if (![0, 1, 2, 4, 9].includes(body.status)) {
            return reply.code(400).send({ ok: false, message: "invalid status" });
        }

        const info = await app.prisma.mallRN_order_info.findFirst({
            where: {
                uid,
                tenant_id: tenantId,
                platform_type: PLATFORM_TYPE,
            },
            select: {
                uid: true,
                order_num: true,
            },
        });

        if (!info) {
            return reply.code(404).send({ ok: false, message: "order not found" });
        }

        const goods = await app.prisma.mallRN_order_goods.findMany({
            where: {
                order_num: String(info.order_num ?? ""),
                tenant_id: tenantId,
                platform_type: PLATFORM_TYPE,
            },
            select: {
                uid: true,
                status: true,
                status2: true,
            },
        });

        if (!goods.length) {
            return reply.code(404).send({ ok: false, message: "order goods not found" });
        }

        const now = toUnixNow();

        await app.prisma.$transaction(async (tx: any) => {
            await tx.mallRN_order_info.update({
                where: { uid: info.uid },
                data: {
                    status_date: now,
                },
            });

            await tx.mallRN_order_goods.updateMany({
                where: {
                    order_num: String(info.order_num ?? ""),
                    tenant_id: tenantId,
                    platform_type: PLATFORM_TYPE,
                },
                data: {
                    status: body.status,
                    status_date: now,
                },
            });

            for (const row of goods) {
                await tx.mallRN_order_log.create({
                    data: {
                        order_num: String(info.order_num ?? ""),
                        og_uid: Number(row.uid),
                        id: actor.actorId || actor.actorType,
                        prev_status: Number(row.status ?? 0),
                        prev_status2: Number(row.status2 ?? 0),
                        status: body.status,
                        status2: Number(row.status2 ?? 0),
                        signdate: now,
                    },
                });
            }
        });

        return reply.send({
            ok: true,
            tenant: tenantSlug,
            id: String(info.uid),
            orderNum: String(info.order_num ?? ""),
            status: body.status,
            statusLabel: statusLabel(body.status),
        });
    });
}