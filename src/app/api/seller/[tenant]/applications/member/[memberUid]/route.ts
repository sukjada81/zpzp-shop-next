// src/app/api/seller/[tenant]/applications/member/[memberUid]/route.ts
import { NextRequest, NextResponse } from "next/server";

function getApiBaseUrl() {
    return (
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:4000"
    );
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ tenant: string; memberUid: string }> | { tenant: string; memberUid: string } }
) {
    const resolved = await Promise.resolve(context.params);
    const tenant = String(resolved?.tenant ?? "").trim();
    const memberUid = String(resolved?.memberUid ?? "").trim();

    const apiBase = getApiBaseUrl();
    const url = new URL(`/v1/seller/applications/member/${memberUid}`, apiBase);

    try {
        const res = await fetch(url.toString(), {
            method: "DELETE",
            cache: "no-store",
            headers: {
                cookie: request.headers.get("cookie") || "",
                "x-tenant-slug": tenant,
                accept: "application/json",
            },
        });

        const payload = await res.json().catch(() => null);
        return NextResponse.json(
            payload ?? { ok: false, message: "delete failed" },
            { status: res.status || 500 }
        );
    } catch {
        return NextResponse.json({ ok: false, message: "delete failed" }, { status: 500 });
    }
}
