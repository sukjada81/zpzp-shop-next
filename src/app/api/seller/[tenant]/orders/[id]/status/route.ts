// src/app/api/seller/[tenant]/orders/[id]/status/route.ts
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

function getOrderNo(item: AnyObj): string {
    return String(item?.orderNum ?? item?.order_no ?? item?.orderNo ?? item?.uid ?? item?.id ?? "-");
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

async function forwardInternalJson(
    request: NextRequest,
    path: string,
    method: "PATCH" | "PUT",
    body: any
): Promise<{ ok: boolean; status: number; data: any }> {
    const url = new URL(path, request.nextUrl.origin);

    try {
        const res = await fetch(url.toString(), {
            method,
            headers: {
                "content-type": "application/json",
                accept: "application/json",
                cookie: request.headers.get("cookie") || "",
            },
            body: JSON.stringify(body),
            cache: "no-store",
        });

        const data = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, data };
    } catch {
        return { ok: false, status: 500, data: null };
    }
}

export async function PATCH(
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

    const verify = await fetchInternalJson(
        request,
        `/api/admin/orders?tenant=${encodeURIComponent(tenant)}&page=1&pageSize=200&limit=200`
    );

    const rows =
        verify.data?.items ??
        verify.data?.rows ??
        verify.data?.data ??
        verify.data?.orders ??
        (Array.isArray(verify.data) ? verify.data : []);

    const order = Array.isArray(rows)
        ? rows.find((row) => String(row?.id ?? row?.uid ?? "") === id)
        : null;

    if (!verify.ok || !order) {
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

    const body = await request.json().catch(() => null);
    const nextStatusRaw = body?.status;
    const nextStatus = Number(nextStatusRaw);

    if (!Number.isFinite(nextStatus)) {
        return NextResponse.json(
            { ok: false, message: "변경할 상태값이 필요합니다." },
            { status: 400 }
        );
    }

    const orderNo = getOrderNo(order);
    if (!orderNo || orderNo === "-") {
        return NextResponse.json(
            { ok: false, message: "주문번호를 확인할 수 없습니다." },
            { status: 400 }
        );
    }

    const result = await forwardInternalJson(
        request,
        `/api/admin/orders/${encodeURIComponent(orderNo)}/status`,
        "PATCH",
        { status: nextStatus }
    );

    if (!result.ok) {
        const fallback = await forwardInternalJson(
            request,
            `/api/admin/orders/${encodeURIComponent(orderNo)}/status`,
            "PUT",
            { status: nextStatus }
        );

        if (!fallback.ok) {
            return NextResponse.json(
                {
                    ok: false,
                    message:
                        fallback.data?.message ||
                        result.data?.message ||
                        "주문 상태 변경에 실패했습니다.",
                },
                { status: fallback.status || result.status || 500 }
            );
        }

        return NextResponse.json({
            ok: true,
            message: "주문 상태가 변경되었습니다.",
            data: fallback.data,
        });
    }

    return NextResponse.json({
        ok: true,
        message: "주문 상태가 변경되었습니다.",
        data: result.data,
    });
}