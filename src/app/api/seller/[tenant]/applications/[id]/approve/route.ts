// src/app/api/seller/[tenant]/applications/[id]/approve/route.ts
import { NextRequest, NextResponse } from "next/server";

function getApiBaseUrl() {
    return (
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:4000"
    );
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ tenant: string; id: string }> | { tenant: string; id: string } }
) {
    const resolved = await Promise.resolve(context.params);
    const tenant = String(resolved?.tenant ?? "").trim();
    const id = String(resolved?.id ?? "").trim();

    const apiBase = getApiBaseUrl();
    const url = new URL(`/v1/seller/applications/${id}/approve`, apiBase);

    try {
        const res = await fetch(url.toString(), {
            method: "POST",
            cache: "no-store",
            headers: {
                cookie: request.headers.get("cookie") || "",
                "x-tenant-slug": tenant,
                accept: "application/json",
            },
        });

        const payload = await res.json().catch(() => null);
        return NextResponse.json(
            payload ?? { ok: false, message: "approve failed" },
            { status: res.status || 500 }
        );
    } catch {
        return NextResponse.json({ ok: false, message: "approve failed" }, { status: 500 });
    }
}
