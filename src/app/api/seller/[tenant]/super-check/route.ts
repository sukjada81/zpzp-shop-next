// src/app/api/seller/[tenant]/super-check/route.ts
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
    const target = new URL("/v1/seller/super-check", apiBase);

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
        return NextResponse.json(
            payload ?? { ok: false, isSuperAdmin: false },
            { status: res.status || 500 }
        );
    } catch {
        return NextResponse.json({ ok: false, isSuperAdmin: false }, { status: 500 });
    }
}
