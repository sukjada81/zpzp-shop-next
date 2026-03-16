// src/app/api/seller/[tenant]/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";

type AnyObj = Record<string, any>;

function toArray<T = AnyObj>(payload: any): T[] {
    if (Array.isArray(payload)) return payload as T[];
    if (Array.isArray(payload?.items)) return payload.items as T[];
    if (Array.isArray(payload?.data)) return payload.data as T[];
    if (Array.isArray(payload?.rows)) return payload.rows as T[];
    if (Array.isArray(payload?.products)) return payload.products as T[];
    if (Array.isArray(payload?.orders)) return payload.orders as T[];
    return [];
}

function getTenantSlugValue(item: AnyObj): string {
    return String(item?.tenantSlug ?? item?.tenant_slug ?? item?.tenant?.slug ?? "").trim();
}

function getTenantIdValue(item: AnyObj): string {
    return String(item?.tenant_id ?? item?.tenantId ?? item?.tenant?.id ?? item?.tenant ?? "").trim();
}

function matchesTenant(item: AnyObj, tenant: string): boolean {
    const slug = getTenantSlugValue(item);
    if (slug) return slug === tenant;
    return getTenantIdValue(item) === tenant;
}

function getStatusValue(item: AnyObj): string {
    return String(item?.status ?? item?.order_status ?? item?.orderStatus ?? "").trim().toLowerCase();
}

function getStatusNumber(item: AnyObj): number | null {
    const n = Number(item?.status ?? item?.order_status ?? item?.orderStatus);
    return Number.isFinite(n) ? n : null;
}

function getBoolean(item: AnyObj, keys: string[]): boolean {
    for (const key of keys) {
        if (typeof item?.[key] === "boolean") return item[key];
        if (item?.[key] === 1 || item?.[key] === "1") return true;
        if (item?.[key] === 0 || item?.[key] === "0") return false;
    }
    return false;
}

function parseDateLike(v: any): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

function getCreatedAt(item: AnyObj): Date | null {
    return (
        parseDateLike(item?.createdAt) ??
        parseDateLike(item?.created_at) ??
        parseDateLike(item?.regdate) ??
        parseDateLike(item?.signdate) ??
        null
    );
}

function isToday(date: Date | null) {
    if (!date) return false;
    const now = new Date();
    return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    );
}

function isWithinLastDays(date: Date | null, days: number) {
    if (!date) return false;
    const now = new Date();
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(now.getDate() - (days - 1));
    return date >= from && date <= now;
}

function getCountText(value: number, unit: string) {
    return `${value.toLocaleString("ko-KR")}${unit}`;
}

function ratio(value: number, total: number) {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.round((value / total) * 100));
}

function isPendingOrder(item: AnyObj): boolean {
    const statusNum = getStatusNumber(item);
    if (statusNum !== null) return statusNum === 0 || statusNum === 1 || statusNum === 2;
    const status = getStatusValue(item);
    return ["pending", "paid", "ready", "preparing", "confirmed"].includes(status);
}

function isCompletedOrder(item: AnyObj): boolean {
    const statusNum = getStatusNumber(item);
    if (statusNum !== null) return statusNum === 4;
    const status = getStatusValue(item);
    return ["completed", "done", "delivered", "picked_up"].includes(status);
}

function isCanceledOrder(item: AnyObj): boolean {
    const statusNum = getStatusNumber(item);
    if (statusNum !== null) return statusNum === 9;
    const status = getStatusValue(item);
    return ["canceled", "cancelled", "cancel", "refund", "refunded"].includes(status);
}

async function fetchInternalJson(request: NextRequest, path: string): Promise<any | null> {
    const url = new URL(path, request.nextUrl.origin);

    try {
        const res = await fetch(url.toString(), {
            method: "GET",
            headers: {
                cookie: request.headers.get("cookie") || "",
            },
            cache: "no-store",
        });

        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ tenant: string }> | { tenant: string } }
) {
    const resolved = await Promise.resolve(context.params);
    const tenant = String(resolved?.tenant ?? "").trim();

    if (!tenant) {
        return NextResponse.json({ ok: false, message: "tenant is required" }, { status: 400 });
    }

    const [productsRaw, ordersRaw, membersRaw] = await Promise.all([
        fetchInternalJson(request, `/api/admin/products?tenant=${encodeURIComponent(tenant)}&page=1&pageSize=2000&limit=2000`),
        fetchInternalJson(request, `/api/admin/orders?tenant=${encodeURIComponent(tenant)}&page=1&pageSize=2000&limit=2000`),
        fetchInternalJson(request, `/api/seller/${encodeURIComponent(tenant)}/members?summaryOnly=1`),
    ]);

    const allProducts = toArray(productsRaw);
    const allOrders = toArray(ordersRaw);

    const products = allProducts.filter((item) => matchesTenant(item, tenant));
    const orders = allOrders.filter((item) => matchesTenant(item, tenant));

    const memberSummary = membersRaw?.summary ?? {
        totalMembers: 0,
        todaySignups: 0,
        weekSignups: 0,
        todayInflows: 0,
        todayLogins: 0,
        sourceReady: false,
    };

    const todayOrders = orders.filter((item) => isToday(getCreatedAt(item))).length;
    const pendingOrders = orders.filter((item) => isPendingOrder(item)).length;

    const activeProducts = products.filter((item) => {
        const status = getStatusValue(item);
        return status === "active" || status === "sale" || status === "selling";
    }).length;

    const soldOutProducts = products.filter((item) => {
        const status = getStatusValue(item);
        return (
            status === "soldout" ||
            status === "sold_out" ||
            status === "outofstock" ||
            status === "out_of_stock" ||
            getBoolean(item, ["is_sold_out", "isSoldOut"])
        );
    }).length;

    const last7Orders = orders.filter((item) => isWithinLastDays(getCreatedAt(item), 7));
    const recentOrderCount = last7Orders.length;
    const completedOrderCount = last7Orders.filter((item) => isCompletedOrder(item)).length;
    const canceledOrderCount = last7Orders.filter((item) => isCanceledOrder(item)).length;

    const now = new Date();

    return NextResponse.json({
        ok: true,
        tenant,
        summary: {
            title: `매장 ${tenant}`,
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
                    value: Number(memberSummary.todaySignups ?? 0),
                    unit: "명",
                    hint: "tenant 가입 회원",
                    tone: "green",
                },
                {
                    key: "weekSignups",
                    label: "최근 7일 회원가입",
                    value: Number(memberSummary.weekSignups ?? 0),
                    unit: "명",
                    hint: "최근 7일 신규 회원",
                    tone: "blue",
                },
                {
                    key: "todayInflows",
                    label: "오늘 유입수",
                    value: Number(memberSummary.todayInflows ?? 0),
                    unit: "명",
                    hint: "추후 유입 로그 연동",
                    tone: "orange",
                },
                {
                    key: "todayLogins",
                    label: "오늘 로그인한 수",
                    value: Number(memberSummary.todayLogins ?? 0),
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
            productCountFetched: products.length,
            orderCountFetched: orders.length,
            memberSourceReady: Boolean(memberSummary.sourceReady),
        },
    });
}