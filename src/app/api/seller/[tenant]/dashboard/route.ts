// src/app/api/seller/[tenant]/dashboard/page.tsx
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

function getTenantIdValue(item: AnyObj): string {
    return String(
        item?.tenant_id ??
        item?.tenantId ??
        item?.tenant?.id ??
        item?.tenant ??
        ""
    );
}

function getStatusValue(item: AnyObj): string {
    return String(item?.status ?? item?.order_status ?? item?.orderStatus ?? "")
        .trim()
        .toLowerCase();
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

function getCreatedAt(item: AnyObj): Date | null {
    return (
        parseDateLike(item?.created_at) ??
        parseDateLike(item?.createdAt) ??
        parseDateLike(item?.regdate) ??
        parseDateLike(item?.signdate) ??
        null
    );
}

function getCountText(value: number, unit: string) {
    return `${value.toLocaleString("ko-KR")}${unit}`;
}

function ratio(value: number, total: number) {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.round((value / total) * 100));
}

async function fetchInternalJson(
    request: NextRequest,
    path: string
): Promise<any | null> {
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
    const tenant = resolved?.tenant;

    if (!tenant) {
        return NextResponse.json(
            { ok: false, message: "tenant is required" },
            { status: 400 }
        );
    }

    const [productsRaw, ordersRaw] = await Promise.all([
        fetchInternalJson(request, `/api/admin/products?page=1&pageSize=2000&limit=2000`),
        fetchInternalJson(request, `/api/admin/orders?page=1&pageSize=2000&limit=2000`),
    ]);

    const allProducts = toArray(productsRaw);
    const allOrders = toArray(ordersRaw);

    const products = allProducts.filter((item) => getTenantIdValue(item) === String(tenant));
    const orders = allOrders.filter((item) => getTenantIdValue(item) === String(tenant));

    const todayOrders = orders.filter((item) => isToday(getCreatedAt(item))).length;

    const pendingStatuses = ["pending", "paid", "ready", "preparing", "confirmed"];
    const completedStatuses = ["completed", "done", "delivered", "picked_up"];
    const purchaseConfirmedStatuses = ["purchase_confirmed", "confirmed_done", "settled"];
    const canceledStatuses = ["canceled", "cancelled", "cancel", "refund", "refunded"];

    const pendingOrders = orders.filter((item) =>
        pendingStatuses.includes(getStatusValue(item))
    ).length;

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

    const last7Orders = orders.filter((item) =>
        isWithinLastDays(getCreatedAt(item), 7)
    );

    const recentOrderCount = last7Orders.length;
    const completedOrderCount = last7Orders.filter((item) =>
        completedStatuses.includes(getStatusValue(item))
    ).length;
    const purchaseConfirmedCount = last7Orders.filter((item) =>
        purchaseConfirmedStatuses.includes(getStatusValue(item))
    ).length;
    const canceledOrderCount = last7Orders.filter((item) =>
        canceledStatuses.includes(getStatusValue(item))
    ).length;

    const now = new Date();
    const dateLabel = now.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    const updatedAt = now.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
    });

    return NextResponse.json({
        ok: true,
        tenant,
        summary: {
            title: `매장 ${tenant}`,
            subtitle: "오늘 매장 운영 현황",
            dateLabel,
            updatedAt,

            // 회원/유입/로그인 지표는 추후 실제 API 연동 예정
            memberKpis: [
                {
                    key: "todaySignups",
                    label: "오늘 회원가입",
                    value: 0,
                    unit: "명",
                    hint: "금일 가입자",
                    tone: "green",
                },
                {
                    key: "weekSignups",
                    label: "회원가입 수",
                    value: 0,
                    unit: "명",
                    hint: "최근 일주일",
                    tone: "blue",
                },
                {
                    key: "todayInflows",
                    label: "오늘 유입수",
                    value: 0,
                    unit: "명",
                    hint: "방문/유입",
                    tone: "orange",
                },
                {
                    key: "todayLogins",
                    label: "오늘 로그인한 수",
                    value: 0,
                    unit: "명",
                    hint: "로그인 사용자",
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
                    hint: "확인/준비 필요",
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
                        percent: 100,
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
                        key: "purchaseConfirmed",
                        label: "구매확정",
                        value: purchaseConfirmedCount,
                        text: getCountText(purchaseConfirmedCount, "건"),
                        percent: ratio(purchaseConfirmedCount, recentOrderCount),
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
        },
    });
}