// apps/api/src/modules/seller/dashboard.routes.ts
import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../common/guard.js";

const PLATFORM_TYPE = "DAD";
const GLOBAL_ALLOWED_ROLES = ["hq_admin", "hq_staff", "hq_super"] as const;
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

type SalesRange = "day" | "month" | "year";
type Tone = "green" | "blue" | "orange" | "red";

type BuiltOrder = {
    uid: number;
    orderNo: string;
    buyerName: string;
    createdAt: Date | null;
    status: number;
    amount: number;
    qty: number;
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

function toMonthStart(d = new Date()) {
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function toYearStart(d = new Date()) {
    return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
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

function isCurrentMonth(date: Date | null, base = new Date()) {
    if (!date) return false;
    return (
        date.getFullYear() === base.getFullYear() &&
        date.getMonth() === base.getMonth()
    );
}

function isCurrentYear(date: Date | null, base = new Date()) {
    if (!date) return false;
    return date.getFullYear() === base.getFullYear();
}

function orderStatusNumber(row: any): number {
    return toInt(row?.status, -1);
}

function isPendingOrder(row: any) {
    const status = typeof row === "object" && row ? orderStatusNumber(row) : toInt(row, -1);
    return status === 0 || status === 1 || status === 2;
}

function isCompletedOrder(row: any) {
    const status = typeof row === "object" && row ? orderStatusNumber(row) : toInt(row, -1);
    return status === 4;
}

function isCanceledOrder(row: any) {
    const status = typeof row === "object" && row ? orderStatusNumber(row) : toInt(row, -1);
    return status === 9;
}

function getProductStatus(row: any) {
    const s = String(row?.status ?? "").trim().toLowerCase();
    return s;
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

function getMoneyText(value: number) {
    return `${Math.max(0, value).toLocaleString("ko-KR")}원`;
}

function ratio(value: number, total: number) {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.round((value / total) * 100));
}

function sumGoodsAmount(goods: any[], field: "price") {
    return goods.reduce((acc, row) => {
        if (isCanceledOrder(row)) return acc;
        const unit = toInt(row?.[field], 0);
        const qty = toInt(row?.qty, 0);
        return acc + unit * qty;
    }, 0);
}

function sumGoodsQty(goods: any[]) {
    return goods.reduce((acc, row) => {
        if (isCanceledOrder(row)) return acc;
        return acc + toInt(row?.qty, 0);
    }, 0);
}

function deriveOrderStatus(goods: any[]) {
    if (!goods.length) return 0;
    const statuses = goods.map((row) => toInt(row?.status, 0));
    if (statuses.every((x) => x === 9)) return 9;
    if (statuses.some((x) => x === 0 || x === 1 || x === 2)) {
        return statuses.find((x) => x === 0 || x === 1 || x === 2) ?? statuses[0];
    }
    return statuses[0] ?? 0;
}

function buildSalesBuckets(range: SalesRange, now = new Date()) {
    if (range === "day") {
        return Array.from({ length: 14 }).map((_, index) => {
            const d = new Date(now);
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - (13 - index));
            const end = new Date(d);
            end.setHours(23, 59, 59, 999);

            return {
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
                label: `${d.getMonth() + 1}/${d.getDate()}`,
                from: d,
                to: end,
            };
        });
    }

    if (range === "month") {
        return Array.from({ length: 12 }).map((_, index) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1, 0, 0, 0, 0);
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

            return {
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
                label: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`,
                from: d,
                to: end,
            };
        });
    }

    return Array.from({ length: 5 }).map((_, index) => {
        const year = now.getFullYear() - (4 - index);
        const from = new Date(year, 0, 1, 0, 0, 0, 0);
        const to = new Date(year, 11, 31, 23, 59, 59, 999);

        return {
            key: String(year),
            label: `${year}년`,
            from,
            to,
        };
    });
}

function aggregateSalesByBuckets(orders: BuiltOrder[], range: SalesRange, now = new Date()) {
    const buckets = buildSalesBuckets(range, now);

    return buckets.map((bucket) => {
        const rows = orders.filter((order) => {
            if (!order.createdAt) return false;
            return order.createdAt >= bucket.from && order.createdAt <= bucket.to;
        });

        const amount = rows.reduce((acc, row) => acc + row.amount, 0);
        const orderCount = rows.length;

        return {
            key: bucket.key,
            label: bucket.label,
            amount,
            orderCount,
            amountText: getMoneyText(amount),
        };
    });
}

function getChartMax(points: { amount: number; orderCount: number }[]) {
    const amountMax = Math.max(...points.map((x) => x.amount), 0);
    const orderCountMax = Math.max(...points.map((x) => x.orderCount), 0);

    return {
        amountMax: amountMax > 0 ? amountMax : 1,
        orderCountMax: orderCountMax > 0 ? orderCountMax : 1,
    };
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

            const [memberships, members, products, orderInfos, orderGoods] = await Promise.all([
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
                        platform_type: PLATFORM_TYPE,
                    },
                    select: {
                        uid: true,
                        order_num: true,
                        name: true,
                        signdate: true,
                        pay_total: true,
                        cancel_total: true,
                        refund_total: true,
                    },
                    orderBy: [{ uid: "desc" }],
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
                        qty: true,
                        price: true,
                    },
                }),
            ]);

            const memberUidSet = new Set(
                memberships
                    .map((x: any) => Number(x.member_uid))
                    .filter((x) => Number.isFinite(x) && x > 0)
            );

            const tenantMembers = members.filter((m: any) => memberUidSet.has(Number(m.uid)));
            const memberMap = new Map(tenantMembers.map((m: any) => [Number(m.uid), m]));

            const weekStart = toDateDaysAgo(6);
            const todayStart = toDateStart();
            const monthStart = toMonthStart();
            const yearStart = toYearStart();

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

            const goodsMap = new Map<string, any[]>();
            for (const row of orderGoods) {
                const key = String(row.order_num ?? "");
                const list = goodsMap.get(key) ?? [];
                list.push(row);
                goodsMap.set(key, list);
            }

            const orders: BuiltOrder[] = orderInfos.map((info: any) => {
                const goods = goodsMap.get(String(info.order_num ?? "")) ?? [];
                const createdAt = getOrderCreatedAt(info) ?? getOrderCreatedAt(goods[0]);
                const goodsAmount = sumGoodsAmount(goods, "price");
                const fallbackNetAmount = Math.max(
                    0,
                    toInt(info.pay_total, 0) - toInt(info.cancel_total, 0) - toInt(info.refund_total, 0)
                );

                return {
                    uid: toInt(info.uid, 0),
                    orderNo: String(info.order_num ?? ""),
                    buyerName: String(info.name ?? "").trim(),
                    createdAt,
                    status: deriveOrderStatus(goods),
                    amount: goodsAmount > 0 ? goodsAmount : fallbackNetAmount,
                    qty: sumGoodsQty(goods),
                };
            });

            const validOrders = orders.filter((o) => o.status !== 9);
            const salesOrders = validOrders
                .filter((o) => o.amount > 0)
                .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

            const todayOrders = validOrders.filter((o) => isSameDay(o.createdAt)).length;
            const pendingOrders = validOrders.filter((o) => isPendingOrder(o.status)).length;

            const last7Orders = validOrders.filter((o) => isOnOrAfter(o.createdAt, weekStart));
            const recentOrderCount = last7Orders.length;
            const completedOrderCount = last7Orders.filter((o) => isCompletedOrder(o.status)).length;
            const canceledOrderCount = orders.filter(
                (o) => isOnOrAfter(o.createdAt, weekStart) && isCanceledOrder(o.status)
            ).length;

            const todaySalesAmount = salesOrders
                .filter((o) => isSameDay(o.createdAt, todayStart))
                .reduce((acc, row) => acc + row.amount, 0);

            const monthSalesAmount = salesOrders
                .filter((o) => isCurrentMonth(o.createdAt, monthStart))
                .reduce((acc, row) => acc + row.amount, 0);

            const yearSalesAmount = salesOrders
                .filter((o) => isCurrentYear(o.createdAt, yearStart))
                .reduce((acc, row) => acc + row.amount, 0);

            const todaySalesOrderCount = salesOrders.filter((o) => isSameDay(o.createdAt, todayStart)).length;

            const dayPoints = aggregateSalesByBuckets(salesOrders, "day");
            const dayMax = getChartMax(dayPoints);

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
                            hint: "오늘 가입 회원",
                            tone: "green" as Tone,
                        },
                        {
                            key: "weekSignups",
                            label: "최근 7일 회원가입",
                            value: weekSignups,
                            unit: "명",
                            hint: "최근 7일 신규 회원",
                            tone: "blue" as Tone,
                        },
                        {
                            key: "todayInflows",
                            label: "오늘 유입수",
                            value: 0,
                            unit: "명",
                            hint: "추후 연동 예정",
                            tone: "orange" as Tone,
                        },
                        {
                            key: "todayLogins",
                            label: "오늘 로그인한 수",
                            value: todayLogins,
                            unit: "명",
                            hint: "오늘 로그인 회원",
                            tone: "blue" as Tone,
                        },
                    ],
                    operationKpis: [
                        {
                            key: "todayOrders",
                            label: "오늘 주문",
                            value: todayOrders,
                            unit: "건",
                            hint: "오늘 접수된 주문",
                            tone: "green" as Tone,
                        },
                        {
                            key: "pendingOrders",
                            label: "처리 대기",
                            value: pendingOrders,
                            unit: "건",
                            hint: "접수/결제/준비 상태",
                            tone: "blue" as Tone,
                        },
                        // {
                        //     key: "activeProducts",
                        //     label: "판매중 상품",
                        //     value: activeProducts,
                        //     unit: "개",
                        //     hint: "현재 노출중",
                        //     tone: "orange" as Tone,
                        // },
                        // {
                        //     key: "soldOutProducts",
                        //     label: "품절 상품",
                        //     value: soldOutProducts,
                        //     unit: "개",
                        //     hint: "재고 확인 필요",
                        //     tone: "blue" as Tone,
                        // },
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
                                tone: "blue" as Tone,
                            },
                            {
                                key: "completed",
                                label: "주문완료",
                                value: completedOrderCount,
                                text: getCountText(completedOrderCount, "건"),
                                percent: ratio(completedOrderCount, recentOrderCount),
                                tone: "green" as Tone,
                            },
                            {
                                key: "canceled",
                                label: "주문취소",
                                value: canceledOrderCount,
                                text: getCountText(canceledOrderCount, "건"),
                                percent: ratio(canceledOrderCount, recentOrderCount),
                                tone: "red" as Tone,
                            },
                        ],
                        note: "최근 7일 기준입니다.",
                    },
                    sales: {
                        title: "매출 통계",
                        subtitle: "실시간 주문 흐름",
                        basis: "주문 기준 요약",
                        cards: [
                            {
                                key: "todaySales",
                                label: "당일 매출",
                                value: todaySalesAmount,
                                unit: "원",
                                text: getMoneyText(todaySalesAmount),
                                hint: "오늘 발생한 주문 매출",
                                tone: "green" as Tone,
                            },
                            {
                                key: "monthSales",
                                label: "이번달 매출",
                                value: monthSalesAmount,
                                unit: "원",
                                text: getMoneyText(monthSalesAmount),
                                hint: "이번달 누적 주문 매출",
                                tone: "blue" as Tone,
                            },
                            {
                                key: "yearSales",
                                label: "올해 매출",
                                value: yearSalesAmount,
                                unit: "원",
                                text: getMoneyText(yearSalesAmount),
                                hint: "연간 누적 주문 매출",
                                tone: "orange" as Tone,
                            },
                            {
                                key: "todaySalesOrders",
                                label: "오늘 매출 주문",
                                value: todaySalesOrderCount,
                                unit: "건",
                                text: getCountText(todaySalesOrderCount, "건"),
                                hint: "오늘 매출 반영 주문 수",
                                tone: "blue" as Tone,
                            },
                        ],
                        chart: {
                            range: "day" as SalesRange,
                            legend: [
                                { key: "sales", label: "매출", type: "bar", colorClass: "bg-emerald-500" },
                                { key: "orders", label: "주문수", type: "line", colorClass: "bg-violet-500" },
                            ],
                            points: dayPoints,
                            amountMax: dayMax.amountMax,
                            orderCountMax: dayMax.orderCountMax,
                        },
                    },
                },
                debug: {
                    actor: {
                        role: permission.grantedRole,
                        scopeType: permission.grantedScopeType,
                    },
                },
            });
        }
    );
}