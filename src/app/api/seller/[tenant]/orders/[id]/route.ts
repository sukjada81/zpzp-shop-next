// src/app/api/seller/[tenant]/orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

type AnyObj = Record<string, any>;

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

function parseDateLike(v: any): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

function getDateText(item: AnyObj): string {
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

function getOrderNo(item: AnyObj): string {
    return String(item?.orderNum ?? item?.order_no ?? item?.orderNo ?? item?.uid ?? item?.id ?? "-");
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

async function fetchInternalJson(
    request: NextRequest,
    path: string
): Promise<{ ok: boolean; status: number; data: any }> {
    const url = new URL(path, request.nextUrl.origin);

    try {
        const res = await fetch(url.toString(), {
            method: "GET",
            headers: {
                cookie: request.headers.get("cookie") || "",
            },
            cache: "no-store",
        });

        const data = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, data };
    } catch {
        return { ok: false, status: 500, data: null };
    }
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ tenant: string; id: string }> | { tenant: string; id: string } }
) {
    const resolved = await Promise.resolve(context.params);
    const tenant = String(resolved?.tenant ?? "").trim();
    const id = String(resolved?.id ?? "").trim();

    if (!tenant || !id) {
        return NextResponse.json(
            { ok: false, message: "tenant and id are required" },
            { status: 400 }
        );
    }

    const result = await fetchInternalJson(
        request,
        `/api/admin/orders?tenant=${encodeURIComponent(tenant)}&page=1&pageSize=200&limit=200`
    );

    const rows =
        result.data?.items ??
        result.data?.rows ??
        result.data?.data ??
        result.data?.orders ??
        (Array.isArray(result.data) ? result.data : []);

    const order = Array.isArray(rows)
        ? rows.find((row) => String(row?.id ?? row?.uid ?? "") === id)
        : null;

    if (!result.ok || !order) {
        return NextResponse.json(
            { ok: false, message: "주문 정보를 찾을 수 없습니다." },
            { status: 404 }
        );
    }

    if (!matchesTenant(order, tenant)) {
        return NextResponse.json(
            { ok: false, message: "해당 매장 주문이 아닙니다." },
            { status: 403 }
        );
    }

    return NextResponse.json({
        ok: true,
        item: {
            id: String(order?.id ?? order?.uid ?? ""),
            orderNo: getOrderNo(order),
            buyerName: getBuyerName(order),
            amount: getAmount(order),
            status: String(order?.statusLabel ?? order?.status ?? "pending"),
            createdAtText: getDateText(order),
            phone: String(
                order?.buyerPhone ??
                order?.buyer_phone ??
                order?.phone ??
                order?.receiverPhone ??
                order?.receiver_phone ??
                ""
            ),
            memo: String(order?.memo ?? order?.order_memo ?? ""),
            address: String(
                order?.address ??
                order?.receiver_address ??
                order?.address1 ??
                ""
            ),
            raw: order,
        },
    });
}