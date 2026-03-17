// apps/api/src/modules/seller/dashboard.routes.ts
import type { FastifyInstance } from "fastify";
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

function getSessionMember(req: any): MemberSession | null {
    const member = req.session?.member as MemberSession | undefined;
    if (!member?.uid) return null;
    return member;
}

function toInt(v: unknown, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toDateStart(d = new Date()) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function toDateDaysAgo(days: number) {
    const x = toDateStart(new Date());
    x.setDate(x.getDate() - days);
    return x;
}

function unixToDate(v: unknown): Date | null {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n) || n <= 0) return null;
    const d = new Date(n * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
}

function parseAnyDate(v: unknown): Date | null {
    if (!v) return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;

    const d = new Date(v as any);
    return Number.isNaN(d.getTime()) ? null : d;
}

function getOrderCreatedAt(row: any): Date | null {
    return (
        parseAnyDate(row?.created_at_dt) ??
        parseAnyDate(row?.createdAt) ??
        parseAnyDate(row?.created_at) ??
        unixToDate(row?.signdate) ??
        null
    );
}

function getMemberJoinedAt(ms: any, member: any): Date | null {
    return (
        parseAnyDate(ms?.joined_at) ??
        parseAnyDate(member?.created_at_dt) ??
        unixToDate(member?.signdate) ??
        null
    );
}

function getMemberLastLoginAt(member: any): Date | null {
    return (
        parseAnyDate(member?.last_login_at_dt) ??
        unixToDate(member?.login_time) ??
        null
    );
}

function isSameDay(date: Date | null, base = new Date()) {
    if (!date) return false;
    return (
        date.getFullYear() === base.getFullYear() &&
        date.getMonth() === base.getMonth() &&
        date.getDate() === base.getDate()
    );
}

function isOnOrAfter(date: Date | null, from: Date) {
    if (!date) return false;
    return date >= from;
}

function orderStatusNumber(row: any): number {
    return toInt(row?.status, -1);
}

function isPendingOrder(row: any) {
    const status = orderStatusNumber(row);
    return status === 0 || status === 1 || status === 2;
}

function isCompletedOrder(row: any) {
    return orderStatusNumber(row) === 4;
}

function isCanceledOrder(row: any) {
    return orderStatusNumber(row) === 9;
}

function getProductStatus(row: any) {
    return String(row?.status ?? "").trim().toLowerCase();
}

function isActiveProduct(row: any) {
    const s = getProductStatus(row);
    return s === "active" || s === "sale" || s === "selling";
}

function isSoldOutProduct(row: any) {
    const s = getProductStatus(row);
    return (
        s === "soldout" ||
        s === "sold_out" ||
        s === "outofstock" ||
        s === "out_of_stock" ||
        row?.is_sold_out === 1 ||
        row?.isSoldOut === true
    );
}

function getCountText(value: number, unit: string) {
    return `${value.toLocaleString("ko-KR")}${unit}`;
}

function ratio(value: number, total: number) {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.round((value / total) * 100));
}

async function resolveSellerPermission(
    app: FastifyInstance,
    req: any,
    tenantId: bigint
): Promise<
    | {
    ok: true;
    memberUid: number;
    grantedRole: string;
    grantedScopeType: "global" | "tenant";
}
    | {
    ok: false;
    code: 401 | 403;
    message: string;
}
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
        select: { uid: true },
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
                    role_code: { in: [...GLOBAL_ALLOWED_ROLES] },
                },
                {
                    scope_type: "tenant",
                    scope_id: tenantId,
                    role_code: { in: [...TENANT_ALLOWED_ROLES] },
                },
            ],
        },
        orderBy: [{ is_primary: "desc" }, { uid: "asc" }],
        select: {
            role_code: true,
            scope_type: true,
        },
    });

    if (!membership) {
        return { ok: false, code: 403, message: "seller permission denied" };
    }

    return {
        ok: true,
        memberUid,
        grantedRole: String(membership.role_code ?? ""),
        grantedScopeType: membership.scope_type === "global" ? "global" : "tenant",
    };
}

export async function sellerDashboardRoutes(app: FastifyInstance) {
    app.get(
        "/v1/seller/dashboard",
        { preHandler: requireTenant() },
        async (req: any, reply) => {
            const tenantSlug = String(req.tenantSlug ?? "");
            const tenantId = req.tenantId as bigint;

            const permission = await resolveSellerPermission(app, req, tenantId);
            if (!permission.ok) {
                return reply.code(permission.code).send({
                    ok: false,
                    message: permission.message,
                });
            }

            const [memberships, members, products, orderInfos, orderGoods] =
                await Promise.all([
                    app.prisma.mallRN_member_membership.findMany({
                        where: {
                            scope_type: "tenant",
                            scope_id: tenantId,
                            role_code: "consumer",
                            status: "active",
                        },
                        select: {
                            uid: true,
                            member_uid: true,
                            joined_at: true,
                        },
                    }),
                    app.prisma.mallRN_member.findMany({
                        where: {
                            status: "active",
                            deleted_at: null,
                        },
                        select: {
                            uid: true,
                            created_at_dt: true,
                            last_login_at_dt: true,
                            login_time: true,
                            signdate: true,
                        },
                    }),
                    app.prisma.mallRN_goods.findMany({
                        where: {
                            tenant_id: tenantId,
                            deleted_at: null,
                        },
                        select: {
                            uid: true,
                            status: true,
                        },
                    }),
                    app.prisma.mallRN_order_info.findMany({
                        where: {
                            tenant_id: tenantId,
                        },
                        select: {
                            uid: true,
                            order_num: true,
                            signdate: true,
                        },
                    }),
                    app.prisma.mallRN_order_goods.findMany({
                        where: {
                            tenant_id: tenantId,
                            platform_type: PLATFORM_TYPE,
                        },
                        orderBy: [{ uid: "asc" }],
                        select: {
                            uid: true,
                            order_num: true,
                            status: true,
                            signdate: true,
                        },
                    }),
                ]);

            const memberUidSet = new Set(
                memberships.map((x: any) => Number(x.member_uid)).filter((x) => Number.isFinite(x) && x > 0)
            );

            const tenantMembers = members.filter((m: any) => memberUidSet.has(Number(m.uid)));
            const memberMap = new Map(tenantMembers.map((m: any) => [Number(m.uid), m]));

            const todayStart = toDateStart();
            const weekStart = toDateDaysAgo(6);

            const totalMembers = tenantMembers.length;

            const todaySignups = memberships.filter((ms: any) =>
                isSameDay(getMemberJoinedAt(ms, memberMap.get(Number(ms.member_uid)) ?? null))
            ).length;

            const weekSignups = memberships.filter((ms: any) =>
                isOnOrAfter(
                    getMemberJoinedAt(ms, memberMap.get(Number(ms.member_uid)) ?? null),
                    weekStart
                )
            ).length;

            const todayLogins = tenantMembers.filter((m: any) =>
                isSameDay(getMemberLastLoginAt(m))
            ).length;

            const activeProducts = products.filter(isActiveProduct).length;
            const soldOutProducts = products.filter(isSoldOutProduct).length;

            const orderGoodsMap = new Map<string, any[]>();
            for (const row of orderGoods) {
                const key = String(row.order_num ?? "");
                const list = orderGoodsMap.get(key) ?? [];
                list.push(row);
                orderGoodsMap.set(key, list);
            }

            const orders = orderInfos.map((info: any) => {
                const goods = orderGoodsMap.get(String(info.order_num ?? "")) ?? [];
                const first = goods[0] ?? null;
                return {
                    uid: info.uid,
                    order_num: info.order_num,
                    signdate: info.signdate,
                    status: first?.status ?? null,
                };
            });

            const todayOrders = orders.filter((o: any) =>
                isSameDay(getOrderCreatedAt(o))
            ).length;

            const pendingOrders = orders.filter(isPendingOrder).length;

            const last7Orders = orders.filter((o: any) =>
                isOnOrAfter(getOrderCreatedAt(o), weekStart)
            );
            const recentOrderCount = last7Orders.length;
            const completedOrderCount = last7Orders.filter(isCompletedOrder).length;
            const canceledOrderCount = last7Orders.filter(isCanceledOrder).length;

            const now = new Date();

            return reply.send({
                ok: true,
                tenant: tenantSlug,
                summary: {
                    title: `매장 ${tenantSlug}`,
                    subtitle: "오늘 매장 운영 현황",
                    dateLabel: now.toLocaleDateString("ko-KR"),
                    updatedAt: now.toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                    }),
                    memberKpis: [
                        {
                            key: "todaySignups",
                            label: "오늘 회원가입",
                            value: todaySignups,
                            unit: "명",
                            hint: "tenant 가입 회원",
                            tone: "green",
                        },
                        {
                            key: "weekSignups",
                            label: "최근 7일 회원가입",
                            value: weekSignups,
                            unit: "명",
                            hint: "최근 7일 신규 회원",
                            tone: "blue",
                        },
                        {
                            key: "todayInflows",
                            label: "오늘 유입수",
                            value: 0,
                            unit: "명",
                            hint: "추후 유입 로그 연동",
                            tone: "orange",
                        },
                        {
                            key: "todayLogins",
                            label: "오늘 로그인한 수",
                            value: todayLogins,
                            unit: "명",
                            hint: "오늘 로그인 회원",
                            tone: "blue",
                        },
                    ],
                    operationKpis: [
                        {
                            key: "todayOrders",
                            label: "오늘 주문",
                            value: todayOrders,
                            unit: "건",
                            hint: "금일 생성 주문",
                            tone: "green",
                        },
                        {
                            key: "pendingOrders",
                            label: "처리 대기",
                            value: pendingOrders,
                            unit: "건",
                            hint: "접수/결제/준비 상태",
                            tone: "blue",
                        },
                        {
                            key: "activeProducts",
                            label: "판매중 상품",
                            value: activeProducts,
                            unit: "개",
                            hint: "현재 노출중",
                            tone: "orange",
                        },
                        {
                            key: "soldOutProducts",
                            label: "품절 상품",
                            value: soldOutProducts,
                            unit: "개",
                            hint: "재고 확인 필요",
                            tone: "blue",
                        },
                    ],
                    recentWeek: {
                        total: recentOrderCount,
                        rows: [
                            {
                                key: "recentOrders",
                                label: "최근 주문 수",
                                value: recentOrderCount,
                                text: getCountText(recentOrderCount, "건"),
                                percent: recentOrderCount > 0 ? 100 : 0,
                                tone: "blue",
                            },
                            {
                                key: "completed",
                                label: "주문완료",
                                value: completedOrderCount,
                                text: getCountText(completedOrderCount, "건"),
                                percent: ratio(completedOrderCount, recentOrderCount),
                                tone: "green",
                            },
                            {
                                key: "canceled",
                                label: "주문취소",
                                value: canceledOrderCount,
                                text: getCountText(canceledOrderCount, "건"),
                                percent: ratio(canceledOrderCount, recentOrderCount),
                                tone: "red",
                            },
                        ],
                        note: "※ 퍼센트 바는 최근 7일 주문 수 대비 비율입니다.",
                    },
                },
                debug: {
                    totalMembers,
                    sourceReady: true,
                    actor: {
                        role: permission.grantedRole,
                        scopeType: permission.grantedScopeType,
                    },
                },
            });
        }
    );
}