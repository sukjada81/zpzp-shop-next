// apps/api/src/modules/seller/orders.routes.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireTenant } from "../../common/guard.js";

const PLATFORM_TYPE = "DAD";
const GLOBAL_ALLOWED_ROLES = ["hq_admin", "hq_staff"] as const;
const TENANT_ALLOWED_ROLES = ["seller_owner", "seller_staff"] as const;

type MemberSession = {
    uid?: string | number;
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    provider?: string;
    tenantId?: string | number;
    tenantSlug?: string;
};

type SellerActor = {
    memberUid: number;
    actorId: string;
    actorName: string;
    actorType: "member";
    grantedRole: string;
    grantedScopeType: "global" | "tenant";
    grantedScopeId: bigint | null;
};

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

function getSessionMember(req: any): MemberSession | null {
    const member = req.session?.member as MemberSession | undefined;
    if (!member?.uid) return null;
    return member;
}

async function resolveSellerActor(
    app: FastifyInstance,
    req: any,
    tenantId: bigint
): Promise<
    | { ok: true; actor: SellerActor }
    | { ok: false; code: 401 | 403; message: string }
> {
    const member = getSessionMember(req);

    if (!member?.uid) {
        return { ok: false, code: 401, message: "seller login required" };
    }

    const memberUid = toInt(member.uid, 0);
    if (memberUid <= 0) {
        return { ok: false, code: 401, message: "invalid member session" };
    }

    const memberRow = await app.prisma.mallRN_member.findFirst({
        where: {
            uid: memberUid,
            status: "active",
            deleted_at: null,
        },
        select: {
            uid: true,
            id: true,
            name: true,
            email: true,
        },
    });

    if (!memberRow) {
        return { ok: false, code: 403, message: "seller permission denied" };
    }

    const membership = await app.prisma.mallRN_member_membership.findFirst({
        where: {
            member_uid: memberUid,
            status: "active",
            OR: [
                {
                    scope_type: "global",
                    role_code: {
                        in: [...GLOBAL_ALLOWED_ROLES],
                    },
                },
                {
                    scope_type: "tenant",
                    scope_id: tenantId,
                    role_code: {
                        in: [...TENANT_ALLOWED_ROLES],
                    },
                },
            ],
        },
        orderBy: [{ is_primary: "desc" }, { uid: "asc" }],
        select: {
            uid: true,
            role_code: true,
            scope_type: true,
            scope_id: true,
            status: true,
        },
    });

    if (!membership) {
        return { ok: false, code: 403, message: "seller permission denied" };
    }

    return {
        ok: true,
        actor: {
            memberUid,
            actorId: normalizeText(memberRow.id || member.uid || memberUid),
            actorName: normalizeText(memberRow.name || member.name || "member"),
            actorType: "member",
            grantedRole: normalizeText(membership.role_code),
            grantedScopeType:
                membership.scope_type === "global" ? "global" : "tenant",
            grantedScopeId:
                membership.scope_id != null
                    ? BigInt(String(membership.scope_id))
                    : null,
        },
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

type GoodsMetaRow = {
    uid: number;
    sale_end_at: Date | null;
    pickup_start_at: Date | null;
    pickup_end_at: Date | null;
};

function formatDateTimeIsoToText(value?: Date | null) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function pickStrictestSaleEnd(rows: GoodsMetaRow[]): Date | null {
    let earliest: Date | null = null;
    for (const r of rows) {
        if (!r.sale_end_at) continue;
        const end = r.sale_end_at instanceof Date ? r.sale_end_at : new Date(r.sale_end_at);
        if (Number.isNaN(end.getTime())) continue;
        if (!earliest || end.getTime() < earliest.getTime()) earliest = end;
    }
    return earliest;
}

function pickEarliestPickupStart(rows: GoodsMetaRow[]): Date | null {
    let earliest: Date | null = null;
    for (const r of rows) {
        if (!r.pickup_start_at) continue;
        const t = r.pickup_start_at instanceof Date ? r.pickup_start_at : new Date(r.pickup_start_at);
        if (Number.isNaN(t.getTime())) continue;
        if (!earliest || t.getTime() < earliest.getTime()) earliest = t;
    }
    return earliest;
}

function pickLatestPickupEnd(rows: GoodsMetaRow[]): Date | null {
    let latest: Date | null = null;
    for (const r of rows) {
        if (!r.pickup_end_at) continue;
        const t = r.pickup_end_at instanceof Date ? r.pickup_end_at : new Date(r.pickup_end_at);
        if (Number.isNaN(t.getTime())) continue;
        if (!latest || t.getTime() > latest.getTime()) latest = t;
    }
    return latest;
}

function canSellerCancel(status: number): boolean {
    return status !== 9;
}

function buildOrderListItem(info: any, goods: any[], goodsMeta: GoodsMetaRow[]) {
    const currentStatus = goods[0] ? Number(goods[0].status ?? 0) : 0;
    const saleEndAt = pickStrictestSaleEnd(goodsMeta);
    const pickupStart = pickEarliestPickupStart(goodsMeta);
    const pickupEnd = pickLatestPickupEnd(goodsMeta);

    return {
        id: String(info.uid),
        orderNo: String(info.order_num ?? ""),
        buyerName: info.name ?? "",
        amount: Number(info.pay_total ?? 0),
        status: currentStatus,
        statusLabel: statusLabel(currentStatus),
        canCancel: canSellerCancel(currentStatus),
        createdAt: unixToIso(info.signdate),
        createdAtText: formatDateTimeText(info.signdate),
        phone: info.cell ?? "",
        memo: info.memo ?? "",
        address: [info.address1 ?? "", info.address2 ?? ""].filter(Boolean).join(" ").trim(),
        itemSummary: buildOrderSummary(goods),
        saleEndAt: saleEndAt ? saleEndAt.toISOString() : null,
        saleEndAtText: formatDateTimeIsoToText(saleEndAt),
        pickupStartAt: pickupStart ? pickupStart.toISOString() : null,
        pickupStartAtText: formatDateTimeIsoToText(pickupStart),
        pickupEndAt: pickupEnd ? pickupEnd.toISOString() : null,
        pickupEndAtText: formatDateTimeIsoToText(pickupEnd),
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

function buildOrderDetailItem(info: any, goods: any[], goodsMeta: GoodsMetaRow[]) {
    const currentStatus = goods[0] ? Number(goods[0].status ?? 0) : 0;
    const saleEndAt = pickStrictestSaleEnd(goodsMeta);
    const pickupStart = pickEarliestPickupStart(goodsMeta);
    const pickupEnd = pickLatestPickupEnd(goodsMeta);

    return {
        id: String(info.uid),
        orderNo: String(info.order_num ?? ""),
        buyerName: info.name ?? "",
        amount: Number(info.pay_total ?? 0),
        status: currentStatus,
        statusLabel: statusLabel(currentStatus),
        canCancel: canSellerCancel(currentStatus),
        createdAt: unixToIso(info.signdate),
        createdAtText: formatDateTimeText(info.signdate),
        phone: info.cell ?? "",
        memo: info.memo ?? "",
        address: [info.address1 ?? "", info.address2 ?? ""].filter(Boolean).join(" ").trim(),
        message: info.message ?? "",
        receiverName: info.name2 ?? "",
        receiverPhone: info.cell2 ?? "",
        saleEndAt: saleEndAt ? saleEndAt.toISOString() : null,
        saleEndAtText: formatDateTimeIsoToText(saleEndAt),
        pickupStartAt: pickupStart ? pickupStart.toISOString() : null,
        pickupStartAtText: formatDateTimeIsoToText(pickupStart),
        pickupEndAt: pickupEnd ? pickupEnd.toISOString() : null,
        pickupEndAtText: formatDateTimeIsoToText(pickupEnd),
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

async function loadGoodsMetaForOrders(
    app: FastifyInstance,
    orderNums: string[],
    tenantId: bigint
) {
    if (!orderNums.length) {
        return {
            byOrderNum: new Map<string, GoodsMetaRow[]>(),
        };
    }

    const orderGoods = await app.prisma.mallRN_order_goods.findMany({
        where: {
            order_num: { in: orderNums },
            tenant_id: tenantId,
            platform_type: PLATFORM_TYPE,
        },
        select: { order_num: true, g_uid: true },
    });

    const uids = Array.from(
        new Set(orderGoods.map((r: any) => Number(r.g_uid)).filter((n: number) => n > 0))
    );

    const products: GoodsMetaRow[] = uids.length
        ? await app.prisma.mallRN_goods.findMany({
            where: { uid: { in: uids } },
            select: {
                uid: true,
                sale_end_at: true,
                pickup_start_at: true,
                pickup_end_at: true,
            },
        })
        : [];

    const productByUid = new Map<number, GoodsMetaRow>();
    for (const p of products) productByUid.set(Number(p.uid), p);

    const byOrderNum = new Map<string, GoodsMetaRow[]>();
    for (const row of orderGoods) {
        const key = String(row.order_num ?? "");
        const meta = productByUid.get(Number(row.g_uid));
        if (!meta) continue;
        const list = byOrderNum.get(key) ?? [];
        list.push(meta);
        byOrderNum.set(key, list);
    }

    return { byOrderNum };
}

export async function sellerOrderRoutes(app: FastifyInstance) {
    app.addHook("preHandler", requireTenant());

    app.get("/v1/seller/orders", async (req: any, reply) => {
        const tenantSlug: string | undefined = req.tenantSlug;
        const tenantId = req.tenantId as bigint;

        const actorResult = await resolveSellerActor(app, req, tenantId);
        if (!actorResult.ok) {
            return reply
                .code(actorResult.code)
                .send({ ok: false, message: actorResult.message });
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

        const { byOrderNum: metaByOrderNum } = await loadGoodsMetaForOrders(
            app,
            orderNums,
            tenantId
        );

        let items = rows.map((row: any) => {
            const orderNum = String(row.order_num ?? "");
            const goods = goodsMap.get(orderNum) ?? [];
            const meta = metaByOrderNum.get(orderNum) ?? [];
            return buildOrderListItem(row, goods, meta);
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
            actor: {
                role: actorResult.actor.grantedRole,
                scopeType: actorResult.actor.grantedScopeType,
            },
        });
    });

    app.get("/v1/seller/orders/:id", async (req: any, reply) => {
        const tenantSlug: string | undefined = req.tenantSlug;
        const tenantId = req.tenantId as bigint;

        const actorResult = await resolveSellerActor(app, req, tenantId);
        if (!actorResult.ok) {
            return reply
                .code(actorResult.code)
                .send({ ok: false, message: actorResult.message });
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

        const { byOrderNum: metaByOrderNum } = await loadGoodsMetaForOrders(
            app,
            [String(info.order_num ?? "")],
            tenantId
        );
        const meta = metaByOrderNum.get(String(info.order_num ?? "")) ?? [];

        return reply.send({
            ok: true,
            tenant: tenantSlug,
            item: buildOrderDetailItem(info, goods, meta),
            actor: {
                role: actorResult.actor.grantedRole,
                scopeType: actorResult.actor.grantedScopeType,
            },
        });
    });

    app.patch("/v1/seller/orders/:id/status", async (req: any, reply) => {
        const tenantSlug: string | undefined = req.tenantSlug;
        const tenantId = req.tenantId as bigint;

        const actorResult = await resolveSellerActor(app, req, tenantId);
        if (!actorResult.ok) {
            return reply
                .code(actorResult.code)
                .send({ ok: false, message: actorResult.message });
        }

        const actor = actorResult.actor;

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

        const currentStatus = Number(goods[0]?.status ?? 0);

        // 취소된 주문은 상태 변경 불가 (셀러도 9 → 어떤 상태로도 못 바꿈)
        if (currentStatus === 9) {
            return reply.code(400).send({
                ok: false,
                error: "already_canceled",
                message: "이미 취소된 주문은 상태를 변경할 수 없습니다.",
            });
        }

        const now = toUnixNow();
        const actorNickname = normalizeText(actor.actorName) || String(actor.memberUid);

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
                        id: actor.actorId || String(actor.memberUid),
                        prev_status: Number(row.status ?? 0),
                        prev_status2: Number(row.status2 ?? 0),
                        status: body.status,
                        status2: Number(row.status2 ?? 0),
                        signdate: now,
                    },
                });
            }

            // 분쟁용 액션 로그: 취소(9), 픽업확인(4) 시 닉네임 포함하여 기록
            if (body.status === 9 || body.status === 4) {
                const eventType: "cancel" | "pickup_confirm" =
                    body.status === 9 ? "cancel" : "pickup_confirm";

                for (const row of goods) {
                    await tx.dad_order_action_log.create({
                        data: {
                            tenant_id: tenantId,
                            event_type: eventType,
                            order_num: String(info.order_num ?? ""),
                            order_goods_uid: Number(row.uid),
                            actor_role: "seller",
                            actor_member_uid: BigInt(actor.memberUid),
                            actor_nickname: actorNickname.slice(0, 100),
                            before_status: Number(row.status ?? 0),
                            after_status: body.status,
                        },
                    });
                }
            }
        });

        return reply.send({
            ok: true,
            tenant: tenantSlug,
            id: String(info.uid),
            orderNum: String(info.order_num ?? ""),
            status: body.status,
            statusLabel: statusLabel(body.status),
            actor: {
                role: actor.grantedRole,
                scopeType: actor.grantedScopeType,
            },
        });
    });
}