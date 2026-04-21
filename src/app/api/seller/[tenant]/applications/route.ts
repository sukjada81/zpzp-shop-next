// src/app/api/seller/[tenant]/applications/route.ts
import { NextRequest, NextResponse } from "next/server";

function getApiBaseUrl() {
    return (
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:4000"
    );
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ tenant: string }> | { tenant: string } }
) {
    const resolved = await Promise.resolve(context.params);
    const tenant = String(resolved?.tenant ?? "").trim();

    const apiBase = getApiBaseUrl();
    const url = new URL("/v1/seller/applications", apiBase);

    const status = request.nextUrl.searchParams.get("status");
    if (status) url.searchParams.set("status", status);

    try {
        const res = await fetch(url.toString(), {
            method: "GET",
            cache: "no-store",
            headers: {
                cookie: request.headers.get("cookie") || "",
                "x-tenant-slug": tenant,
                accept: "application/json",
            },
        });

        const payload = await res.json().catch(() => null);
        return NextResponse.json(
            payload ?? { ok: false, message: "fetch failed" },
            { status: res.status || 500 }
        );
    } catch {
        return NextResponse.json({ ok: false, message: "fetch failed" }, { status: 500 });
    }
}
