// src/app/api/seller/[tenant]/members/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

function getApiBase() {
    return (
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:4000"
    ).replace(/\/+$/, "");
}

async function fetchBackend(request: NextRequest, tenant: string, path: string) {
    const res = await fetch(`${getApiBase()}${path}`, {
        method: "GET",
        headers: {
            accept: "application/json",
            cookie: request.headers.get("cookie") || "",
            "x-tenant-slug": tenant,
        },
        cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
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

    const result = await fetchBackend(request, tenant, `/v1/seller/members/${encodeURIComponent(id)}`);

    return NextResponse.json(result.data ?? {
        ok: false,
        message: "member fetch failed",
    }, {
        status: result.status || 500,
    });
}