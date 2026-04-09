// apps/api/src/modules/seller/sales.routes.ts
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

type SalesRange = "day" | "month" | "year";

type BuiltOrder = {
    id: string;
    orderNo: string;
    buyerName: string;
    createdAt: Date | null;
    createdAtIso: string | null;
    createdAtText: string;
    status: number;
    statusLabel: string;
    amount: number;
    supplyAmount: number;
    profitAmount: number;
    qty: number;
    itemCount: number;
    itemSummary: string;
};

type AggregatedOptionStat = {
    optionName: string;
    orderCount: number;
    qty: number;
    amount: number;
    supplyAmount: number;
    profitAmount: number;
    orderNoSet: Set<string>;
};

type AggregatedProductRow = {
    id: string;
    productName: string;
    orderCount: number;
    qty: number;
    amount: number;
    supplyAmount: number;
    profitAmount: number;
    lastOrderedAt: Date | null;
    latestOrderId: string;
    latestOrderNo: string;
    optionStats: Map<string, AggregatedOptionStat>;
    orderNoSet: Set<string>;
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

function formatDateTimeText(date: Date | null) {
    if (!date) return "-";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function getMoneyText(value: number) {
    return `${Math.max(0, value).toLocaleString("ko-KR")}원`;
}

function getCountText(value: number, unit: string) {
    return `${value.toLocaleString("ko-KR")}${unit}`;
}

function normalizeText(value: unknown) {
    return String(value ?? "").trim();
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

function isCanceledOrder(row: any) {
    return toInt(row?.status, -1) === 9;
}

function sumGoodsAmount(goods: any[], field: "price" | "orig_price") {
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

function buildOrderSummary(goods: any[]) {
    const validGoods = goods.filter((row) => !isCanceledOrder(row));
    const baseGoods = validGoods.length ? validGoods : goods;

    if (!baseGoods.length) return "";
    const first = baseGoods[0];
    const firstName = String(first?.g_name ?? "").trim();
    if (!firstName) return "";

    if (baseGoods.length === 1) {
        const qty = toInt(first?.qty, 0);
        const optionName = String(first?.option_name ?? "").trim();
        if (optionName && qty > 0) return `${firstName} / ${optionName} × ${qty}`;
        if (optionName) return `${firstName} / ${optionName}`;
        if (qty > 0) return `${firstName} × ${qty}`;
        return firstName;
    }

    return `${firstName} 외 ${baseGoods.length - 1}건`;
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

function aggregateSalesByBuckets(orders: BuiltOrder[], range: SalesRange, now = new Date()) {
    if (range === "day") {
        return Array.from({ length: 14 }).map((_, index) => {
            const d = new Date(now);
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - (13 - index));

            const end = new Date(d);
            end.setHours(23, 59, 59, 999);

            const rows = orders.filter((order) => {
                if (!order.createdAt) return false;
                return order.createdAt >= d && order.createdAt <= end;
            });

            const amount = rows.reduce((acc, row) => acc + row.amount, 0);
            const orderCount = rows.length;

            return {
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
                    d.getDate()
                ).padStart(2, "0")}`,
                label: `${d.getMonth() + 1}/${d.getDate()}`,
                amount,
                orderCount,
                amountText: getMoneyText(amount),
            };
        });
    }

    if (range === "month") {
        return Array.from({ length: 12 }).map((_, index) => {
            const from = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1, 0, 0, 0, 0);
            const to = new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59, 999);

            const rows = orders.filter((order) => {
                if (!order.createdAt) return false;
                return order.createdAt >= from && order.createdAt <= to;
            });

            const amount = rows.reduce((acc, row) => acc + row.amount, 0);
            const orderCount = rows.length;

            return {
                key: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`,
                label: `${from.getFullYear()}.${String(from.getMonth() + 1).padStart(2, "0")}`,
                amount,
                orderCount,
                amountText: getMoneyText(amount),
            };
        });
    }

    return Array.from({ length: 5 }).map((_, index) => {
        const year = now.getFullYear() - (4 - index);
        const from = new Date(year, 0, 1, 0, 0, 0, 0);
        const to = new Date(year, 11, 31, 23, 59, 59, 999);

        const rows = orders.filter((order) => {
            if (!order.createdAt) return false;
            return order.createdAt >= from && order.createdAt <= to;
        });

        const amount = rows.reduce((acc, row) => acc + row.amount, 0);
        const orderCount = rows.length;

        return {
            key: String(year),
            label: `${year}년`,
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

function isInCurrentRange(date: Date | null, range: SalesRange) {
    if (!date) return false;
    const now = new Date();

    if (range === "day") {
        const from = new Date(now);
        from.setHours(0, 0, 0, 0);
        from.setDate(from.getDate() - 13);
        return date >= from && date <= now;
    }

    if (range === "month") {
        const from = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
        return date >= from && date <= now;
    }

    const from = new Date(now.getFullYear() - 4, 0, 1, 0, 0, 0, 0);
    return date >= from && date <= now;
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

export async function sellerSalesRoutes(app: FastifyInstance) {
    app.get(
        "/v1/seller/sales",
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

            const query = z
                .object({
                    range: z.enum(["day", "month", "year"]).optional().default("month"),
                    search: z.string().optional().default(""),
                    status: z.string().optional().default("all"),
                    dateFrom: z.string().optional().default(""),
                    dateTo: z.string().optional().default(""),
                    page: z.coerce.number().int().min(1).optional().default(1),
                    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
                })
                .parse(req.query ?? {});

            const [orderInfos, orderGoods] = await Promise.all([
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
                    select: {
                        uid: true,
                        order_num: true,
                        status: true,
                        signdate: true,
                        g_uid: true,
                        g_name: true,
                        option_name: true,
                        qty: true,
                        price: true,
                        orig_price: true,
                    },
                    orderBy: [{ uid: "asc" }],
                }),
            ]);

            const orderGoodsMap = new Map<string, any[]>();
            for (const row of orderGoods) {
                const key = String(row.order_num ?? "");
                const list = orderGoodsMap.get(key) ?? [];
                list.push(row);
                orderGoodsMap.set(key, list);
            }

            let orders: BuiltOrder[] = orderInfos.map((info: any) => {
                const goods = orderGoodsMap.get(String(info.order_num ?? "")) ?? [];
                const validGoods = goods.filter((row) => !isCanceledOrder(row));
                const goodsForSummary = validGoods.length ? validGoods : goods;
                const createdAt = getOrderCreatedAt(info) ?? getOrderCreatedAt(goods[0]);
                const goodsSalesAmount = sumGoodsAmount(goods, "price");
                const fallbackNetAmount = Math.max(
                    0,
                    toInt(info.pay_total, 0) - toInt(info.cancel_total, 0) - toInt(info.refund_total, 0)
                );
                const amount = goodsSalesAmount > 0 ? goodsSalesAmount : fallbackNetAmount;
                const supplyAmount = sumGoodsAmount(goods, "orig_price");
                const profitAmount = Math.max(0, amount - supplyAmount);
                const status = deriveOrderStatus(goods);

                return {
                    id: String(info.uid),
                    orderNo: String(info.order_num ?? ""),
                    buyerName: String(info.name ?? "").trim(),
                    createdAt,
                    createdAtIso: createdAt ? createdAt.toISOString() : null,
                    createdAtText: formatDateTimeText(createdAt),
                    status,
                    statusLabel: statusLabel(status),
                    amount,
                    supplyAmount,
                    profitAmount,
                    qty: sumGoodsQty(goods),
                    itemCount: validGoods.length || goods.length,
                    itemSummary: buildOrderSummary(goodsForSummary),
                };
            });

            orders = orders.filter((item) => item.status !== 9 && item.amount > 0);

            if (query.range) {
                orders = orders.filter((item) => isInCurrentRange(item.createdAt, query.range));
            }

            if (query.dateFrom) {
                const from = new Date(query.dateFrom);
                if (!Number.isNaN(from.getTime())) {
                    from.setHours(0, 0, 0, 0);
                    orders = orders.filter((item) => item.createdAt && item.createdAt >= from);
                }
            }

            if (query.dateTo) {
                const to = new Date(query.dateTo);
                if (!Number.isNaN(to.getTime())) {
                    to.setHours(23, 59, 59, 999);
                    orders = orders.filter((item) => item.createdAt && item.createdAt <= to);
                }
            }

            if (query.status !== "all") {
                const statusNum = Number(query.status);
                if (Number.isFinite(statusNum)) {
                    orders = orders.filter((item) => item.status === statusNum);
                }
            }

            if (query.search.trim()) {
                const keyword = query.search.trim().toLowerCase();
                orders = orders.filter((item) => {
                    return (
                        item.orderNo.toLowerCase().includes(keyword) ||
                        item.buyerName.toLowerCase().includes(keyword) ||
                        item.itemSummary.toLowerCase().includes(keyword)
                    );
                });
            }

            orders.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

            const totalSales = orders.reduce((acc, row) => acc + row.amount, 0);
            const totalSupply = orders.reduce((acc, row) => acc + row.supplyAmount, 0);
            const totalProfit = orders.reduce((acc, row) => acc + row.profitAmount, 0);
            const totalQty = orders.reduce((acc, row) => acc + row.qty, 0);
            const totalOrderCount = orders.length;

            const chartPoints = aggregateSalesByBuckets(orders, query.range);
            const maxValues = getChartMax(chartPoints);

            const todayStart = toDateStart();
            const monthStart = toMonthStart();
            const yearStart = toYearStart();

            const allOrderBase = orderInfos
                .map((info: any) => {
                    const goods = orderGoodsMap.get(String(info.order_num ?? "")) ?? [];
                    const createdAt = getOrderCreatedAt(info) ?? getOrderCreatedAt(goods[0]);
                    const status = deriveOrderStatus(goods);
                    const amount =
                        sumGoodsAmount(goods, "price") ||
                        Math.max(
                            0,
                            toInt(info.pay_total, 0) - toInt(info.cancel_total, 0) - toInt(info.refund_total, 0)
                        );

                    return {
                        createdAt,
                        amount,
                        status,
                    };
                })
                .filter((row) => row.status !== 9);

            const todaySales = allOrderBase
                .filter((row) => row.createdAt && row.createdAt >= todayStart)
                .reduce((acc, row) => acc + row.amount, 0);

            const monthSales = allOrderBase
                .filter((row) => row.createdAt && row.createdAt >= monthStart)
                .reduce((acc, row) => acc + row.amount, 0);

            const yearSales = allOrderBase
                .filter((row) => row.createdAt && row.createdAt >= yearStart)
                .reduce((acc, row) => acc + row.amount, 0);

            const matchedOrderNoSet = new Set(orders.map((item) => item.orderNo));
            const matchedOrderMap = new Map(orders.map((item) => [item.orderNo, item]));

            const aggregatedMap = new Map<string, AggregatedProductRow>();

            for (const row of orderGoods) {
                const orderNo = String(row.order_num ?? "");
                if (!matchedOrderNoSet.has(orderNo)) continue;
                if (isCanceledOrder(row)) continue;

                const productName = normalizeText(row.g_name) || "상품명 없음";
                const optionName = normalizeText(row.option_name) || "옵션없음";
                const groupKey = productName.toLowerCase();

                const matchedOrder = matchedOrderMap.get(orderNo);
                const createdAt = matchedOrder?.createdAt ?? getOrderCreatedAt(row);
                const qty = toInt(row.qty, 0);
                const amount = toInt(row.price, 0) * qty;
                const supplyAmount = toInt(row.orig_price, 0) * qty;
                const matchedOrderId = matchedOrder?.id ?? "";
                const matchedOrderNo = matchedOrder?.orderNo ?? orderNo;

                let productGroup = aggregatedMap.get(groupKey);

                if (!productGroup) {
                    productGroup = {
                        id: groupKey,
                        productName,
                        orderCount: 0,
                        qty: 0,
                        amount: 0,
                        supplyAmount: 0,
                        profitAmount: 0,
                        lastOrderedAt: createdAt,
                        latestOrderId: matchedOrderId,
                        latestOrderNo: matchedOrderNo,
                        optionStats: new Map<string, AggregatedOptionStat>(),
                        orderNoSet: new Set<string>(),
                    };
                    aggregatedMap.set(groupKey, productGroup);
                }

                if (!productGroup.orderNoSet.has(orderNo)) {
                    productGroup.orderNoSet.add(orderNo);
                    productGroup.orderCount += 1;
                }

                productGroup.qty += qty;
                productGroup.amount += amount;
                productGroup.supplyAmount += supplyAmount;
                productGroup.profitAmount = Math.max(0, productGroup.amount - productGroup.supplyAmount);

                const existingTime = productGroup.lastOrderedAt?.getTime() ?? 0;
                const createdTime = createdAt?.getTime() ?? 0;
                if (createdTime >= existingTime) {
                    productGroup.lastOrderedAt = createdAt;
                    productGroup.latestOrderId = matchedOrderId;
                    productGroup.latestOrderNo = matchedOrderNo;
                }

                let optionStat = productGroup.optionStats.get(optionName);
                if (!optionStat) {
                    optionStat = {
                        optionName,
                        orderCount: 0,
                        qty: 0,
                        amount: 0,
                        supplyAmount: 0,
                        profitAmount: 0,
                        orderNoSet: new Set<string>(),
                    };
                    productGroup.optionStats.set(optionName, optionStat);
                }

                if (!optionStat.orderNoSet.has(orderNo)) {
                    optionStat.orderNoSet.add(orderNo);
                    optionStat.orderCount += 1;
                }

                optionStat.qty += qty;
                optionStat.amount += amount;
                optionStat.supplyAmount += supplyAmount;
                optionStat.profitAmount = Math.max(0, optionStat.amount - optionStat.supplyAmount);
            }

            let detailRows = Array.from(aggregatedMap.values()).map((row) => {
                const optionItems = Array.from(row.optionStats.values())
                    .map((opt) => ({
                        optionName: opt.optionName,
                        orderCount: opt.orderCount,
                        orderCountText: getCountText(opt.orderCount, "건"),
                        qty: opt.qty,
                        qtyText: getCountText(opt.qty, "개"),
                        amount: opt.amount,
                        amountText: getMoneyText(opt.amount),
                        supplyAmount: opt.supplyAmount,
                        supplyAmountText: getMoneyText(opt.supplyAmount),
                        profitAmount: opt.profitAmount,
                        profitAmountText: getMoneyText(opt.profitAmount),
                    }))
                    .sort((a, b) => {
                        if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
                        if (b.qty !== a.qty) return b.qty - a.qty;
                        return a.optionName.localeCompare(b.optionName, "ko");
                    });

                return {
                    id: row.id,
                    productName: row.productName,
                    optionCount: optionItems.length,
                    optionSummary:
                        optionItems.length > 0
                            ? `옵션 ${optionItems.length}종`
                            : "",
                    optionPreviewList: optionItems.slice(0, 6).map((v) => v.optionName),
                    optionItems,
                    orderCount: row.orderCount,
                    orderCountText: getCountText(row.orderCount, "건"),
                    qty: row.qty,
                    qtyText: getCountText(row.qty, "개"),
                    amount: row.amount,
                    amountText: getMoneyText(row.amount),
                    supplyAmount: row.supplyAmount,
                    supplyAmountText: getMoneyText(row.supplyAmount),
                    profitAmount: row.profitAmount,
                    profitAmountText: getMoneyText(row.profitAmount),
                    lastOrderedAt: row.lastOrderedAt ? row.lastOrderedAt.toISOString() : null,
                    lastOrderedAtText: formatDateTimeText(row.lastOrderedAt),
                    latestOrderId: row.latestOrderId,
                    latestOrderNo: row.latestOrderNo,
                };
            });

            detailRows.sort((a, b) => {
                const diff =
                    (b.lastOrderedAt ? new Date(b.lastOrderedAt).getTime() : 0) -
                    (a.lastOrderedAt ? new Date(a.lastOrderedAt).getTime() : 0);
                if (diff !== 0) return diff;
                return b.amount - a.amount;
            });

            const detailTotalCount = detailRows.length;
            const page = query.page;
            const pageSize = query.pageSize;
            const totalPages = Math.max(1, Math.ceil(detailTotalCount / pageSize));
            const start = (page - 1) * pageSize;
            const paged = detailRows.slice(start, start + pageSize);

            return reply.send({
                ok: true,
                tenant: tenantSlug,
                summary: {
                    title: "매출 통계",
                    subtitle: "기간별 주문 흐름",
                    basis: "같은 상품은 한 줄로 묶고 / 옵션별 발주건수와 수량은 내부에서 분리 표시",
                    cards: [
                        {
                            key: "todaySales",
                            label: "당일 매출",
                            value: todaySales,
                            unit: "원",
                            text: getMoneyText(todaySales),
                            hint: "오늘 발생한 주문 매출",
                            tone: "green",
                        },
                        {
                            key: "monthSales",
                            label: "이번달 매출",
                            value: monthSales,
                            unit: "원",
                            text: getMoneyText(monthSales),
                            hint: "이번달 누적 주문 매출",
                            tone: "blue",
                        },
                        {
                            key: "yearSales",
                            label: "올해 매출",
                            value: yearSales,
                            unit: "원",
                            text: getMoneyText(yearSales),
                            hint: "연간 누적 주문 매출",
                            tone: "orange",
                        },
                        {
                            key: "rangeOrderCount",
                            label: "선택구간 주문",
                            value: totalOrderCount,
                            unit: "건",
                            text: getCountText(totalOrderCount, "건"),
                            hint: "현재 검색/필터 기준",
                            tone: "blue",
                        },
                    ],
                    totals: {
                        salesAmount: totalSales,
                        salesAmountText: getMoneyText(totalSales),
                        supplyAmount: totalSupply,
                        supplyAmountText: getMoneyText(totalSupply),
                        profitAmount: totalProfit,
                        profitAmountText: getMoneyText(totalProfit),
                        orderCount: totalOrderCount,
                        orderCountText: getCountText(totalOrderCount, "건"),
                        qty: totalQty,
                        qtyText: getCountText(totalQty, "개"),
                    },
                    chart: {
                        range: query.range,
                        legend: [
                            { key: "sales", label: "매출", type: "bar", colorClass: "bg-emerald-500" },
                            { key: "orders", label: "주문수", type: "line", colorClass: "bg-violet-500" },
                        ],
                        points: chartPoints,
                        amountMax: maxValues.amountMax,
                        orderCountMax: maxValues.orderCountMax,
                    },
                },
                filters: {
                    range: query.range,
                    search: query.search,
                    status: query.status,
                    dateFrom: query.dateFrom,
                    dateTo: query.dateTo,
                    page,
                    pageSize,
                },
                details: {
                    totalCount: detailTotalCount,
                    totalPages,
                    page,
                    pageSize,
                    items: paged,
                },
                actor: {
                    role: permission.grantedRole,
                    scopeType: permission.grantedScopeType,
                },
            });
        }
    );
}