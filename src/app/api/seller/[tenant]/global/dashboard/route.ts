// src/app/api/seller/[tenant]/global/dashboard/route.ts
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
    const target = new URL("/v1/seller/global/dashboard", apiBase);

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
                { ok: false, message: payload?.message || "global dashboard fetch failed" },
                { status: res.status || 500 }
            );
        }

        return NextResponse.json(payload, { status: 200 });
    } catch {
        return NextResponse.json(
            { ok: false, message: "global dashboard fetch failed" },
            { status: 500 }
        );
    }
}
