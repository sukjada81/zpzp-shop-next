// src/app/api/seller/[tenant]/orders/[id]/page.tsx
import { NextRequest, NextResponse } from "next/server";

type AnyObj = Record<string, any>;

function getTenantIdValue(item: AnyObj): string {
    return String(
        item?.tenant_id ??
        item?.tenantId ??
        item?.tenant?.id ??
        item?.tenant ??
        ""
    );
}

function parseDateLike(v: any): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

function getDateText(item: AnyObj): string {
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
    const tenant = resolved?.tenant;
    const id = resolved?.id;

    if (!tenant || !id) {
        return NextResponse.json(
            { ok: false, message: "tenant and id are required" },
            { status: 400 }
        );
    }

    const result = await fetchInternalJson(request, `/api/admin/orders?page=1&pageSize=2000&limit=2000`);
    const rows =
        result.data?.items ??
        result.data?.rows ??
        result.data?.data ??
        result.data?.orders ??
        (Array.isArray(result.data) ? result.data : []);

    const order = Array.isArray(rows)
        ? rows.find((row) => String(row?.uid ?? row?.id ?? "") === String(id))
        : null;

    if (!result.ok || !order) {
        return NextResponse.json(
            { ok: false, message: "주문 정보를 찾을 수 없습니다." },
            { status: 404 }
        );
    }

    if (getTenantIdValue(order) !== String(tenant)) {
        return NextResponse.json(
            { ok: false, message: "해당 매장 주문이 아닙니다." },
            { status: 403 }
        );
    }

    return NextResponse.json({
        ok: true,
        item: {
            id: String(order?.uid ?? order?.id ?? ""),
            orderNo: getOrderNo(order),
            buyerName: getBuyerName(order),
            amount: getAmount(order),
            status: String(order?.status ?? order?.order_status ?? order?.orderStatus ?? "pending"),
            createdAtText: getDateText(order),
            phone: String(order?.buyer_phone ?? order?.phone ?? order?.receiver_phone ?? ""),
            memo: String(order?.memo ?? order?.order_memo ?? ""),
            address: String(order?.address ?? order?.receiver_address ?? ""),
            raw: order,
        },
    });
}