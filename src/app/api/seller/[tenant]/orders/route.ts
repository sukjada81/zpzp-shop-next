// src/app/api/seller/[tenant]/orders/route.ts
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

function getTenantSlugValue(item: AnyObj): string {
    return String(
        item?.tenantSlug ??
        item?.tenant_slug ??
        item?.tenant?.slug ??
        ""
    ).trim();
}

function getTenantIdValue(item: AnyObj): string {
    return String(
        item?.tenant_id ??
        item?.tenantId ??
        item?.tenant?.id ??
        item?.tenant ??
        ""
    ).trim();
}

function matchesTenant(item: AnyObj, tenant: string): boolean {
    const slug = getTenantSlugValue(item);
    if (slug) return slug === tenant;

    const tenantId = getTenantIdValue(item);
    return tenantId === tenant;
}

function getStatusNumber(item: AnyObj): number | null {
    const raw = item?.status ?? item?.order_status ?? item?.orderStatus;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

function getStatusText(item: AnyObj): string {
    const n = getStatusNumber(item);
    if (n !== null) {
        switch (n) {
            case 0:
                return "접수";
            case 1:
                return "현장결제완료";
            case 2:
                return "픽업준비완료";
            case 4:
                return "픽업완료";
            case 9:
                return "주문취소";
            default:
                return `상태(${n})`;
        }
    }

    return String(item?.statusLabel ?? item?.status_label ?? item?.status ?? "pending");
}

function getOrderNo(item: AnyObj): string {
    return String(
        item?.orderNum ??
        item?.order_no ??
        item?.orderNo ??
        item?.uid ??
        item?.id ??
        "-"
    );
}

function getBuyerName(item: AnyObj): string {
    return String(
        item?.buyerName ??
        item?.buyer_name ??
        item?.member_name ??
        item?.receiver_name ??
        item?.name ??
        "주문자"
    );
}

function getAmount(item: AnyObj): number {
    const raw =
        item?.payTotal ??
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
        parseDateLike(item?.createdAt) ??
        parseDateLike(item?.created_at) ??
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
    const tenant = String(resolved?.tenant ?? "").trim();

    if (!tenant) {
        return NextResponse.json(
            { ok: false, message: "tenant is required" },
            { status: 400 }
        );
    }

    const ordersRaw = await fetchInternalJson(
        request,
        `/api/admin/orders?tenant=${encodeURIComponent(tenant)}&page=1&pageSize=200&limit=200`
    );

    const allOrders = toArray(ordersRaw);

    const orders = allOrders
        .filter((item) => matchesTenant(item, tenant))
        .map((item) => ({
            id: String(item?.id ?? item?.uid ?? ""),
            orderNo: getOrderNo(item),
            buyerName: getBuyerName(item),
            amount: getAmount(item),
            status: getStatusText(item),
            statusCode: getStatusNumber(item),
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