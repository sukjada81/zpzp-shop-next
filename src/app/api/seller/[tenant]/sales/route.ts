// src/app/api/seller/[tenant]/sales/route.ts
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

    if (!tenant) {
        return NextResponse.json(
            { ok: false, message: "tenant is required" },
            { status: 400 }
        );
    }

    const apiBase = getApiBaseUrl();
    const target = new URL("/v1/seller/sales", apiBase);

    const searchParams = request.nextUrl.searchParams;
    for (const [key, value] of searchParams.entries()) {
        target.searchParams.set(key, value);
    }

    try {
        const res = await fetch(target.toString(), {
            method: "GET",
            cache: "no-store",
            headers: {
                cookie: request.headers.get("cookie") || "",
                "x-tenant-slug": tenant,
                accept: "application/json",
            },
        });

        const payload = await res.json().catch(() => null);

        if (!res.ok || !payload) {
            return NextResponse.json(
                {
                    ok: false,
                    message: payload?.message || "failed to fetch seller sales",
                },
                { status: res.status || 500 }
            );
        }

        return NextResponse.json(payload, { status: 200 });
    } catch {
        return NextResponse.json(
            { ok: false, message: "seller sales fetch failed" },
            { status: 500 }
        );
    }
}