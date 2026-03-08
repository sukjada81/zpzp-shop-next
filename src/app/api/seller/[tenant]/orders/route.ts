// src/app/api/seller/[tenant]/orders/page.tsx
import { NextRequest, NextResponse } from "next/server";

type AnyObj = Record<string, any>;

function toArray<T = AnyObj>(payload: any): T[] {
    if (Array.isArray(payload)) return payload as T[];
    if (Array.isArray(payload?.items)) return payload.items as T[];
    if (Array.isArray(payload?.data)) return payload.data as T[];
    if (Array.isArray(payload?.rows)) return payload.rows as T[];
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

function getOrderNo(item: AnyObj): string {
    return String(item?.order_no ?? item?.orderNo ?? item?.uid ?? item?.id ?? "-");
}

function getBuyerName(item: AnyObj): string {
    return String(
        item?.buyer_name ??
        item?.buyerName ??
        item?.member_name ??
        item?.receiver_name ??
        "주문자"
    );
}

function getAmount(item: AnyObj): number {
    const raw =
        item?.amount ??
        item?.total_amount ??
        item?.totalPrice ??
        item?.pay_amount ??
        item?.payment_amount ??
        0;

    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
}

function parseDateLike(v: any): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

function getCreatedAtText(item: AnyObj): string {
    const d =
        parseDateLike(item?.created_at) ??
        parseDateLike(item?.createdAt) ??
        parseDateLike(item?.regdate) ??
        parseDateLike(item?.signdate);

    if (!d) return "-";

    return d.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
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

    const ordersRaw = await fetchInternalJson(
        request,
        `/api/admin/orders?page=1&pageSize=2000&limit=2000`
    );

    const allOrders = toArray(ordersRaw);
    const orders = allOrders
        .filter((item) => getTenantIdValue(item) === String(tenant))
        .map((item) => ({
            id: String(item?.uid ?? item?.id ?? ""),
            orderNo: getOrderNo(item),
            buyerName: getBuyerName(item),
            amount: getAmount(item),
            status: getStatusValue(item) || "pending",
            createdAtText: getCreatedAtText(item),
            raw: item,
        }));

    return NextResponse.json({
        ok: true,
        tenant,
        items: orders,
        total: orders.length,
    });
}