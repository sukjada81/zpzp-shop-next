// apps/api/src/modules/admin/orders.routes.ts
import type { FastifyInstance } from "fastify";

type AdminSession = {
    admin?: {
        id: string;
        email?: string | null;
        name: string;
        isSuperAdmin: boolean;
    };
};

function requireSuperAdmin(req: { session?: AdminSession }, reply: any) {
    const admin = req.session?.admin;
    if (!admin?.isSuperAdmin) {
        reply.code(401);
        return reply.send({ ok: false, message: "unauthorized" });
    }
    return null;
}

function jsonSafe<T>(v: T): any {
    if (v === null || v === undefined) return v;

    const t = typeof v;
    if (t === "bigint") return (v as unknown as bigint).toString();
    if (t !== "object") return v;

    if (v instanceof Date) return v.toISOString();

    const ctorName = (v as any)?.constructor?.name;
    if (ctorName === "Decimal" && typeof (v as any).toString === "function") {
        return (v as any).toString();
    }

    if (Array.isArray(v)) return v.map(jsonSafe);

    const out: any = {};
    for (const [k, val] of Object.entries(v as any)) out[k] = jsonSafe(val);
    return out;
}

function toUnixNow() {
    return Math.floor(Date.now() / 1000);
}

function unixToIso(v: unknown) {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n) || n <= 0) return null;
    return new Date(n * 1000).toISOString();
}

function toInt(v: unknown, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function isHqTenantSlug(raw: unknown) {
    const s = String(raw ?? "").trim().toLowerCase();
    return s === "hq" || s === "head" || s === "0" || s === "root";
}

async function resolveTenantIdBySlug(app: FastifyInstance, tenantSlug: string) {
    const slug = String(tenantSlug ?? "").trim();
    if (!slug || slug === "all") return null;

    if (isHqTenantSlug(slug)) {
        return BigInt(0);
    }

    const tenant = await app.prisma.tenant.findUnique({
        where: { slug },
        select: { id: true },
    });

    if (!tenant) return undefined;
    return tenant.id;
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

function payStatusLabel(payStatus: string) {
    switch (String(payStatus ?? "").toUpperCase()) {
        case "A":
            return "주문접수";
        case "B":
            return "처리중";
        case "C":
            return "완료";
        case "D":
            return "실패";
        default:
            return payStatus || "-";
    }
}

export async function adminOrdersRoutes(app: FastifyInstance) {
    app.get("/admin/orders", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const tenantSlug = String(req.query?.tenant ?? "all").trim();
        const statusRaw = String(req.query?.status ?? "").trim();
        const q = String(req.query?.q ?? "").trim();
        const pageNum = Math.max(1, Number(req.query?.page ?? 1) || 1);
        const take = Math.min(100, Math.max(1, Number(req.query?.limit ?? req.query?.pageSize ?? 20) || 20));
        const skip = (pageNum - 1) * take;

        const tenantId = await resolveTenantIdBySlug(app, tenantSlug);
        if (tenantId === undefined) {
            return reply.code(400).send({ ok: false, message: "invalid tenant" });
        }

        const statusFilter = statusRaw === "" ? null : toInt(statusRaw, NaN);

        const infoWhere: any = {
            platform_type: "DAD",
        };

        if (tenantId !== null) {
            infoWhere.tenant_id = tenantId;
        }

        if (q) {
            infoWhere.OR = [
                { order_num: { contains: q } },
                { name: { contains: q } },
                { cell: { contains: q } },
                { name2: { contains: q } },
                { cell2: { contains: q } },
            ];
        }

        if (statusFilter !== null && Number.isFinite(statusFilter)) {
            const goodsOrderNums = await app.prisma.mallRN_order_goods.findMany({
                where: {
                    platform_type: "DAD",
                    ...(tenantId !== null ? { tenant_id: tenantId } : {}),
                    status: statusFilter,
                },
                select: { order_num: true },
                distinct: ["order_num"],
            });

            const orderNums = goodsOrderNums.map((x: any) => String(x.order_num ?? "")).filter(Boolean);

            if (!orderNums.length) {
                return reply.send({
                    ok: true,
                    total: 0,
                    page: pageNum,
                    limit: take,
                    rows: [],
                });
            }

            infoWhere.order_num = { in: orderNums };
        }

        const [total, infoRows] = await Promise.all([
            app.prisma.mallRN_order_info.count({ where: infoWhere }),
            app.prisma.mallRN_order_info.findMany({
                where: infoWhere,
                orderBy: [{ signdate: "desc" }, { uid: "desc" }],
                skip,
                take,
                select: {
                    uid: true,
                    id: true,
                    tenant_id: true,
                    member_uid: true,
                    platform_type: true,
                    order_num: true,
                    name: true,
                    cell: true,
                    name2: true,
                    cell2: true,
                    pay_total: true,
                    cancel_total: true,
                    refund_total: true,
                    delivery_total: true,
                    pay_type: true,
                    pay_status: true,
                    pay_info: true,
                    message: true,
                    memo: true,
                    pickup_at: true,
                    reals: true,
                    mobile: true,
                    status_date: true,
                    signdate: true,
                },
            }),
        ]);

        const tenantIds = Array.from(
            new Set(
                infoRows
                    .map((r: any) => String(r.tenant_id ?? ""))
                    .filter((v: string) => v !== "" && v !== "0")
            )
        );

        const tenantRows =
            tenantIds.length > 0
                ? await app.prisma.tenant.findMany({
                    where: { id: { in: tenantIds.map((v) => BigInt(v)) } },
                    select: { id: true, slug: true, name: true },
                })
                : [];

        const tenantMap = new Map(
            tenantRows.map((t: any) => [
                String(t.id),
                { id: String(t.id), slug: t.slug ?? null, name: t.name ?? null },
            ])
        );

        const orderNums = infoRows.map((r: any) => String(r.order_num ?? "")).filter(Boolean);

        const goodsRows =
            orderNums.length > 0
                ? await app.prisma.mallRN_order_goods.findMany({
                    where: {
                        platform_type: "DAD",
                        order_num: { in: orderNums },
                    },
                    orderBy: [{ uid: "asc" }],
                    select: {
                        uid: true,
                        order_num: true,
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
                        vendor: true,
                        tenant_id: true,
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

        const rows = infoRows.map((row: any) => {
            const orderNum = String(row.order_num ?? "");
            const items = goodsMap.get(orderNum) ?? [];
            const firstItem = items[0] ?? null;
            const currentStatus = firstItem ? Number(firstItem.status ?? 0) : 0;

            const tenant =
                String(row.tenant_id ?? "") === "0"
                    ? { id: "0", slug: "hq", name: "본사 상품" }
                    : tenantMap.get(String(row.tenant_id ?? "")) ?? null;

            return {
                id: String(row.uid),
                orderNo: orderNum,
                orderNum,
                tenantId: String(row.tenant_id ?? "0"),
                tenantSlug: tenant?.slug ?? null,
                tenantName: tenant?.name ?? null,
                tenant,

                memberUid: row.member_uid == null ? null : String(row.member_uid),
                platformType: row.platform_type ?? "DAD",

                buyerId: row.id ?? "",
                buyerName: row.name ?? "",
                buyerPhone: row.cell ?? "",
                receiverName: row.name2 ?? "",
                receiverPhone: row.cell2 ?? "",

                payTotal: Number(row.pay_total ?? 0),
                cancelTotal: Number(row.cancel_total ?? 0),
                refundTotal: Number(row.refund_total ?? 0),
                deliveryTotal: Number(row.delivery_total ?? 0),

                payType: row.pay_type ?? "B",
                payStatus: row.pay_status ?? "A",
                payStatusLabel: payStatusLabel(row.pay_status ?? "A"),
                payInfo: row.pay_info ?? "",

                pickupAt: row.pickup_at ?? null,
                message: row.message ?? "",
                memo: row.memo ?? "",

                status: currentStatus,
                statusLabel: statusLabel(currentStatus),

                itemCount: items.length,
                items: items.map((item: any) => ({
                    id: String(item.uid),
                    productId: String(item.g_uid ?? 0),
                    title: item.g_name ?? "",
                    goodsCode: item.g_code ?? "",
                    price: Number(item.price ?? 0),
                    origPrice: Number(item.orig_price ?? 0),
                    qty: Number(item.qty ?? 0),
                    optionId: Number(item.option ?? 0),
                    optionName: item.option_name ?? "",
                    status: Number(item.status ?? 0),
                    status2: Number(item.status2 ?? 0),
                    vendor: item.vendor ?? "",
                    tenantId: String(item.tenant_id ?? "0"),
                    createdAt: unixToIso(item.signdate),
                })),

                createdAt: unixToIso(row.signdate),
                statusDate: unixToIso(row.status_date),
                reals: Number(row.reals ?? 0),
                mobile: row.mobile ?? "N",
            };
        });

        return reply.send(
            jsonSafe({
                ok: true,
                total,
                page: pageNum,
                limit: take,
                rows,
            })
        );
    });

    app.get("/admin/orders/:orderNum", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const orderNum = String(req.params?.orderNum ?? "").trim();
        if (!orderNum) {
            return reply.code(400).send({ ok: false, message: "orderNum required" });
        }

        const info = await app.prisma.mallRN_order_info.findFirst({
            where: {
                order_num: orderNum,
                platform_type: "DAD",
            },
            select: {
                uid: true,
                id: true,
                tenant_id: true,
                member_uid: true,
                platform_type: true,
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
                pay_info: true,
                pickup_at: true,
                reals: true,
                mobile: true,
                status_date: true,
                signdate: true,
            },
        });

        if (!info) {
            return reply.code(404).send({ ok: false, message: "order not found" });
        }

        const goods = await app.prisma.mallRN_order_goods.findMany({
            where: {
                order_num: orderNum,
                platform_type: "DAD",
            },
            orderBy: [{ uid: "asc" }],
            select: {
                uid: true,
                order_num: true,
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
                vendor: true,
                tenant_id: true,
            },
        });

        let tenant: { id: string; slug: string | null; name: string | null } | null = null;

        if (String(info.tenant_id ?? "0") === "0") {
            tenant = { id: "0", slug: "hq", name: "본사 상품" };
        } else {
            const tenantRow = await app.prisma.tenant.findUnique({
                where: { id: info.tenant_id },
                select: { id: true, slug: true, name: true },
            });

            tenant = tenantRow
                ? {
                    id: String(tenantRow.id),
                    slug: tenantRow.slug ?? null,
                    name: tenantRow.name ?? null,
                }
                : null;
        }

        const currentStatus = goods.length ? Number(goods[0].status ?? 0) : 0;

        return reply.send(
            jsonSafe({
                ok: true,
                order: {
                    id: String(info.uid),
                    orderNo: String(info.order_num ?? ""),
                    orderNum: String(info.order_num ?? ""),
                    tenantId: String(info.tenant_id ?? "0"),
                    tenantSlug: tenant?.slug ?? null,
                    tenantName: tenant?.name ?? null,
                    tenant,

                    memberUid: info.member_uid == null ? null : String(info.member_uid),
                    platformType: info.platform_type ?? "DAD",

                    buyerId: info.id ?? "",
                    buyerName: info.name ?? "",
                    buyerPhone: info.cell ?? "",
                    receiverName: info.name2 ?? "",
                    receiverPhone: info.cell2 ?? "",

                    message: info.message ?? "",
                    memo: info.memo ?? "",

                    payTotal: Number(info.pay_total ?? 0),
                    cancelTotal: Number(info.cancel_total ?? 0),
                    refundTotal: Number(info.refund_total ?? 0),
                    deliveryTotal: Number(info.delivery_total ?? 0),
                    payType: info.pay_type ?? "B",
                    payStatus: info.pay_status ?? "A",
                    payStatusLabel: payStatusLabel(info.pay_status ?? "A"),
                    payInfo: info.pay_info ?? "",

                    pickupAt: info.pickup_at ?? null,
                    createdAt: unixToIso(info.signdate),
                    statusDate: unixToIso(info.status_date),

                    status: currentStatus,
                    statusLabel: statusLabel(currentStatus),

                    items: goods.map((item: any) => ({
                        id: String(item.uid),
                        productId: String(item.g_uid ?? 0),
                        title: item.g_name ?? "",
                        goodsCode: item.g_code ?? "",
                        price: Number(item.price ?? 0),
                        origPrice: Number(item.orig_price ?? 0),
                        qty: Number(item.qty ?? 0),
                        optionId: Number(item.option ?? 0),
                        optionName: item.option_name ?? "",
                        status: Number(item.status ?? 0),
                        status2: Number(item.status2 ?? 0),
                        vendor: item.vendor ?? "",
                        tenantId: String(item.tenant_id ?? "0"),
                        createdAt: unixToIso(item.signdate),
                    })),
                },
            })
        );
    });

    app.patch("/admin/orders/:orderNum/status", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const orderNum = String(req.params?.orderNum ?? "").trim();
        if (!orderNum) {
            return reply.code(400).send({ ok: false, message: "orderNum required" });
        }

        const nextStatus = Number(req.body?.status);
        if (!Number.isFinite(nextStatus)) {
            return reply.code(400).send({ ok: false, message: "status required" });
        }

        const goodsRows = await app.prisma.mallRN_order_goods.findMany({
            where: {
                order_num: orderNum,
                platform_type: "DAD",
            },
            select: {
                uid: true,
                order_num: true,
                status: true,
                status2: true,
            },
        });

        if (!goodsRows.length) {
            return reply.code(404).send({ ok: false, message: "order not found" });
        }

        const now = toUnixNow();
        const adminId = String(req.session?.admin?.id ?? "admin");

        await app.prisma.$transaction(async (tx: any) => {
            await tx.mallRN_order_goods.updateMany({
                where: {
                    order_num: orderNum,
                    platform_type: "DAD",
                },
                data: {
                    status: nextStatus,
                    status_date: now,
                },
            });

            await tx.mallRN_order_info.updateMany({
                where: {
                    order_num: orderNum,
                    platform_type: "DAD",
                },
                data: {
                    status_date: now,
                },
            });

            for (const row of goodsRows) {
                await tx.mallRN_order_log.create({
                    data: {
                        order_num: orderNum,
                        og_uid: row.uid,
                        id: adminId,
                        prev_status: Number(row.status ?? 0),
                        prev_status2: Number(row.status2 ?? 0),
                        status: nextStatus,
                        status2: Number(row.status2 ?? 0),
                        signdate: now,
                    },
                });
            }
        });

        return reply.send({
            ok: true,
            updated: {
                orderNum,
                status: nextStatus,
                statusLabel: statusLabel(nextStatus),
                updatedAt: new Date(now * 1000).toISOString(),
            },
        });
    });
}