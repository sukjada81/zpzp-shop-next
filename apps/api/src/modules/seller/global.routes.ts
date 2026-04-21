// apps/api/src/modules/seller/global.routes.ts
// 전체 지점 합산 대시보드 (hq_super 전용)
import type { FastifyInstance } from "fastify";

const SUPER_ADMIN_ROLE = "hq_super";
const PLATFORM_TYPE = "DAD";

type MemberSession = { uid?: string | number };
type SalesRange = "day" | "month" | "year";
type Tone = "green" | "blue" | "orange" | "red";
type BuiltOrder = { uid: number; orderNo: string; createdAt: Date | null; status: number; amount: number; qty: number };

function getSessionMember(req: any): MemberSession | null {
    const m = req.session?.member as MemberSession | undefined;
    return m?.uid ? m : null;
}

function toInt(v: unknown, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toDateStart(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function toDateDaysAgo(days: number) { const x = toDateStart(); x.setDate(x.getDate()-days); return x; }
function toMonthStart(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1, 0,0,0,0); }
function toYearStart(d = new Date()) { return new Date(d.getFullYear(), 0, 1, 0,0,0,0); }

function unixToDate(v: unknown): Date | null {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n) || n <= 0) return null;
    const d = new Date(n * 1000);
    return isNaN(d.getTime()) ? null : d;
}

function parseAnyDate(v: unknown): Date | null {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? null : d;
}

function getOrderCreatedAt(row: any): Date | null {
    return parseAnyDate(row?.created_at_dt) ?? parseAnyDate(row?.createdAt) ?? parseAnyDate(row?.created_at) ?? unixToDate(row?.signdate) ?? null;
}

function getMemberJoinedAt(ms: any, member: any): Date | null {
    return parseAnyDate(ms?.joined_at) ?? parseAnyDate(member?.created_at_dt) ?? unixToDate(member?.signdate) ?? null;
}

function getMemberLastLoginAt(member: any): Date | null {
    return parseAnyDate(member?.last_login_at_dt) ?? unixToDate(member?.login_time) ?? null;
}

function isSameDay(date: Date | null, base = new Date()) {
    if (!date) return false;
    return date.getFullYear() === base.getFullYear() && date.getMonth() === base.getMonth() && date.getDate() === base.getDate();
}

function isOnOrAfter(date: Date | null, from: Date) { return !!date && date >= from; }
function isCurrentMonth(date: Date | null, base = new Date()) {
    return !!date && date.getFullYear() === base.getFullYear() && date.getMonth() === base.getMonth();
}
function isCurrentYear(date: Date | null, base = new Date()) {
    return !!date && date.getFullYear() === base.getFullYear();
}

function isPendingOrder(s: any) { const n = toInt(s,-1); return n===0||n===1||n===2; }
function isCompletedOrder(s: any) { return toInt(s,-1)===4; }
function isCanceledOrder(s: any) { return toInt(s,-1)===9; }
function isActiveProduct(row: any) { const s = String(row?.status??"").trim().toLowerCase(); return s==="active"||s==="sale"||s==="selling"; }
function isSoldOutProduct(row: any) { const s = String(row?.status??"").trim().toLowerCase(); return s==="soldout"||s==="sold_out"||s==="outofstock"||s==="out_of_stock"; }

function deriveOrderStatus(goods: any[]) {
    if (!goods.length) return 0;
    const ss = goods.map(r => toInt(r?.status,0));
    if (ss.every(x=>x===9)) return 9;
    if (ss.some(x=>x===0||x===1||x===2)) return ss.find(x=>x===0||x===1||x===2) ?? ss[0];
    return ss[0]??0;
}

function sumGoodsAmount(goods: any[]) {
    return goods.reduce((acc,row) => isCanceledOrder(row) ? acc : acc + toInt(row?.price,0)*toInt(row?.qty,0), 0);
}
function sumGoodsQty(goods: any[]) {
    return goods.reduce((acc,row) => isCanceledOrder(row) ? acc : acc + toInt(row?.qty,0), 0);
}

function buildSalesBuckets(now = new Date()) {
    return Array.from({length:14}).map((_,i) => {
        const d = new Date(now); d.setHours(0,0,0,0); d.setDate(d.getDate()-(13-i));
        const end = new Date(d); end.setHours(23,59,59,999);
        return {
            key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
            label: `${d.getMonth()+1}/${d.getDate()}`,
            from: d, to: end,
        };
    });
}

function aggregateSalesByBuckets(orders: BuiltOrder[], now = new Date()) {
    const buckets = buildSalesBuckets(now);
    return buckets.map(b => {
        const rows = orders.filter(o => o.createdAt && o.createdAt >= b.from && o.createdAt <= b.to);
        const amount = rows.reduce((acc,r) => acc+r.amount, 0);
        return { key: b.key, label: b.label, amount, orderCount: rows.length, amountText: `${Math.max(0,amount).toLocaleString("ko-KR")}원` };
    });
}

function getChartMax(points: {amount:number;orderCount:number}[]) {
    return {
        amountMax: Math.max(...points.map(x=>x.amount), 0) || 1,
        orderCountMax: Math.max(...points.map(x=>x.orderCount), 0) || 1,
    };
}

function getCountText(v: number, u: string) { return `${v.toLocaleString("ko-KR")}${u}`; }
function getMoneyText(v: number) { return `${Math.max(0,v).toLocaleString("ko-KR")}원`; }
function ratio(v: number, t: number) { return (!t||t<=0) ? 0 : Math.min(100, Math.round(v/t*100)); }

export async function sellerGlobalRoutes(app: FastifyInstance) {
    app.get("/v1/seller/global/dashboard", async (req: any, reply) => {
        const member = getSessionMember(req);
        if (!member?.uid) return reply.code(401).send({ ok: false, message: "login required" });

        const memberUid = toInt(member.uid, 0);
        const superMs = await app.prisma.mallRN_member_membership.findFirst({
            where: { member_uid: memberUid, status: "active", scope_type: "global", role_code: SUPER_ADMIN_ROLE },
        });
        if (!superMs) return reply.code(403).send({ ok: false, message: "super admin required" });

        // 전체 지점 데이터 (tenant 필터 없음)
        const [memberships, members, products, orderInfos, orderGoods] = await Promise.all([
            app.prisma.mallRN_member_membership.findMany({
                where: { scope_type: "tenant", role_code: "consumer", status: "active" },
                select: { uid: true, member_uid: true, joined_at: true },
            }),
            app.prisma.mallRN_member.findMany({
                where: { status: "active", deleted_at: null },
                select: { uid: true, created_at_dt: true, last_login_at_dt: true, login_time: true, signdate: true },
            }),
            app.prisma.mallRN_goods.findMany({
                where: { deleted_at: null },
                select: { uid: true, status: true },
            }),
            app.prisma.mallRN_order_info.findMany({
                where: { platform_type: PLATFORM_TYPE },
                select: { uid: true, order_num: true, name: true, signdate: true, pay_total: true, cancel_total: true, refund_total: true },
                orderBy: [{ uid: "desc" }],
            }),
            app.prisma.mallRN_order_goods.findMany({
                where: { platform_type: PLATFORM_TYPE },
                orderBy: [{ uid: "asc" }],
                select: { uid: true, order_num: true, status: true, signdate: true, qty: true, price: true },
            }),
        ]);

        const memberUidSet = new Set(memberships.map((x:any) => Number(x.member_uid)).filter((x:number) => x > 0));
        const tenantMembers = members.filter((m:any) => memberUidSet.has(Number(m.uid)));
        const memberMap = new Map(tenantMembers.map((m:any) => [Number(m.uid), m]));

        const weekStart = toDateDaysAgo(6);
        const todayStart = toDateStart();
        const monthStart = toMonthStart();
        const yearStart = toYearStart();

        const todaySignups = memberships.filter((ms:any) => isSameDay(getMemberJoinedAt(ms, memberMap.get(Number(ms.member_uid)) ?? null))).length;
        const weekSignups = memberships.filter((ms:any) => isOnOrAfter(getMemberJoinedAt(ms, memberMap.get(Number(ms.member_uid)) ?? null), weekStart)).length;
        const todayLogins = tenantMembers.filter((m:any) => isSameDay(getMemberLastLoginAt(m))).length;

        const activeProducts = products.filter(isActiveProduct).length;
        const soldOutProducts = products.filter(isSoldOutProduct).length;

        const goodsMap = new Map<string, any[]>();
        for (const row of orderGoods) {
            const key = String(row.order_num ?? "");
            const list = goodsMap.get(key) ?? [];
            list.push(row);
            goodsMap.set(key, list);
        }

        const orders: BuiltOrder[] = orderInfos.map((info:any) => {
            const goods = goodsMap.get(String(info.order_num ?? "")) ?? [];
            const createdAt = getOrderCreatedAt(info) ?? getOrderCreatedAt(goods[0]);
            const goodsAmount = sumGoodsAmount(goods);
            const fallback = Math.max(0, toInt(info.pay_total,0) - toInt(info.cancel_total,0) - toInt(info.refund_total,0));
            return {
                uid: toInt(info.uid,0),
                orderNo: String(info.order_num ?? ""),
                createdAt,
                status: deriveOrderStatus(goods),
                amount: goodsAmount > 0 ? goodsAmount : fallback,
                qty: sumGoodsQty(goods),
            };
        });

        const validOrders = orders.filter(o => o.status !== 9);
        const salesOrders = validOrders.filter(o => o.amount > 0).sort((a,b) => (b.createdAt?.getTime()??0)-(a.createdAt?.getTime()??0));

        const todayOrders = validOrders.filter(o => isSameDay(o.createdAt)).length;
        const pendingOrders = validOrders.filter(o => isPendingOrder(o.status)).length;
        const last7Orders = validOrders.filter(o => isOnOrAfter(o.createdAt, weekStart));
        const recentOrderCount = last7Orders.length;
        const completedOrderCount = last7Orders.filter(o => isCompletedOrder(o.status)).length;
        const canceledOrderCount = orders.filter(o => isOnOrAfter(o.createdAt, weekStart) && isCanceledOrder(o.status)).length;

        const todaySalesAmount = salesOrders.filter(o => isSameDay(o.createdAt, todayStart)).reduce((acc,r) => acc+r.amount, 0);
        const monthSalesAmount = salesOrders.filter(o => isCurrentMonth(o.createdAt, monthStart)).reduce((acc,r) => acc+r.amount, 0);
        const yearSalesAmount = salesOrders.filter(o => isCurrentYear(o.createdAt, yearStart)).reduce((acc,r) => acc+r.amount, 0);
        const todaySalesOrderCount = salesOrders.filter(o => isSameDay(o.createdAt, todayStart)).length;

        const dayPoints = aggregateSalesByBuckets(salesOrders);
        const dayMax = getChartMax(dayPoints);
        const now = new Date();

        return reply.send({
            ok: true,
            tenant: "__all__",
            summary: {
                title: "전체 지점 합산",
                subtitle: "모든 지점 운영 현황",
                dateLabel: now.toLocaleDateString("ko-KR"),
                updatedAt: now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
                memberKpis: [
                    { key: "todaySignups", label: "오늘 회원가입", value: todaySignups, unit: "명", hint: "전체 지점 오늘 가입", tone: "green" as Tone },
                    { key: "weekSignups", label: "최근 7일 회원가입", value: weekSignups, unit: "명", hint: "전체 지점 최근 7일", tone: "blue" as Tone },
                    { key: "todayInflows", label: "오늘 유입수", value: 0, unit: "명", hint: "추후 연동 예정", tone: "orange" as Tone },
                    { key: "todayLogins", label: "오늘 로그인", value: todayLogins, unit: "명", hint: "전체 지점 오늘 로그인", tone: "blue" as Tone },
                ],
                operationKpis: [
                    { key: "todayOrders", label: "오늘 주문", value: todayOrders, unit: "건", hint: "전체 지점 오늘 주문", tone: "green" as Tone },
                    { key: "pendingOrders", label: "처리 대기", value: pendingOrders, unit: "건", hint: "전체 지점 대기 주문", tone: "blue" as Tone },
                    // { key: "activeProducts", label: "판매중 상품", value: activeProducts, unit: "개", hint: "전체 지점 판매중", tone: "orange" as Tone },
                    // { key: "soldOutProducts", label: "품절 상품", value: soldOutProducts, unit: "개", hint: "전체 지점 품절", tone: "blue" as Tone },
                ],
                recentWeek: {
                    total: recentOrderCount,
                    rows: [
                        { key: "recentOrders", label: "최근 주문 수", value: recentOrderCount, text: getCountText(recentOrderCount,"건"), percent: recentOrderCount>0?100:0, tone: "blue" as Tone },
                        { key: "completed", label: "주문완료", value: completedOrderCount, text: getCountText(completedOrderCount,"건"), percent: ratio(completedOrderCount,recentOrderCount), tone: "green" as Tone },
                        { key: "canceled", label: "주문취소", value: canceledOrderCount, text: getCountText(canceledOrderCount,"건"), percent: ratio(canceledOrderCount,recentOrderCount), tone: "red" as Tone },
                    ],
                    note: "최근 7일 기준 · 전체 지점 합산",
                },
                sales: {
                    title: "전체 매출 통계",
                    subtitle: "모든 지점 합산",
                    basis: "주문 기준 요약",
                    cards: [
                        { key: "todaySales", label: "당일 매출", value: todaySalesAmount, unit: "원", text: getMoneyText(todaySalesAmount), hint: "전체 지점 오늘 매출", tone: "green" as Tone },
                        { key: "monthSales", label: "이번달 매출", value: monthSalesAmount, unit: "원", text: getMoneyText(monthSalesAmount), hint: "전체 지점 이번달", tone: "blue" as Tone },
                        { key: "yearSales", label: "올해 매출", value: yearSalesAmount, unit: "원", text: getMoneyText(yearSalesAmount), hint: "전체 지점 연간", tone: "orange" as Tone },
                        { key: "todaySalesOrders", label: "오늘 매출 주문", value: todaySalesOrderCount, unit: "건", text: getCountText(todaySalesOrderCount,"건"), hint: "전체 지점 오늘", tone: "blue" as Tone },
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
        });
    });
}
