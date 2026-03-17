// src/app/api/seller/[tenant]/orders/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";

function getApiBase() {
    return (
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:4000"
    ).replace(/\/+$/, "");
}

async function forward(
    request: NextRequest,
    tenant: string,
    id: string,
    status: number
) {
    const res = await fetch(`${getApiBase()}/v1/seller/orders/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        headers: {
            "content-type": "application/json",
            accept: "application/json",
            cookie: request.headers.get("cookie") || "",
            "x-tenant-slug": tenant,
        },
        body: JSON.stringify({ status }),
        cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
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

    const body = await request.json().catch(() => null);
    const nextStatus = Number(body?.status);

    if (!Number.isFinite(nextStatus)) {
        return NextResponse.json(
            { ok: false, message: "변경할 상태값이 필요합니다." },
            { status: 400 }
        );
    }

    const result = await forward(request, tenant, id, nextStatus);

    if (!result.ok) {
        return NextResponse.json(
            {
                ok: false,
                message:
                    result.data?.message ||
                    "주문 상태 변경에 실패했습니다.",
            },
            { status: result.status || 500 }
        );
    }

    return NextResponse.json({
        ok: true,
        message: "주문 상태가 변경되었습니다.",
        data: result.data,
    });
}