// src/app/api/seller/[tenant]/orders/[id]/status/page.tsx
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
    const tenant = resolved?.tenant;
    const id = resolved?.id;

    if (!tenant || !id) {
        return NextResponse.json(
            { ok: false, message: "tenant and id are required" },
            { status: 400 }
        );
    }

    const verify = await fetchInternalJson(request, `/api/admin/orders?page=1&pageSize=2000&limit=2000`);
    const rows =
        verify.data?.items ??
        verify.data?.rows ??
        verify.data?.data ??
        verify.data?.orders ??
        (Array.isArray(verify.data) ? verify.data : []);

    const order = Array.isArray(rows)
        ? rows.find((row) => String(row?.uid ?? row?.id ?? "") === String(id))
        : null;

    if (!verify.ok || !order) {
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

    const body = await request.json().catch(() => null);
    const nextStatus = String(body?.status ?? "").trim();

    if (!nextStatus) {
        return NextResponse.json(
            { ok: false, message: "변경할 상태값이 필요합니다." },
            { status: 400 }
        );
    }

    const result = await forwardInternalJson(
        request,
        `/api/admin/orders/${encodeURIComponent(id)}/status`,
        "PATCH",
        { status: nextStatus }
    );

    if (!result.ok) {
        const fallback = await forwardInternalJson(
            request,
            `/api/admin/orders/${encodeURIComponent(id)}/status`,
            "PUT",
            { status: nextStatus }
        );

        if (!fallback.ok) {
            return NextResponse.json(
                { ok: false, message: fallback.data?.message || result.data?.message || "주문 상태 변경에 실패했습니다." },
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