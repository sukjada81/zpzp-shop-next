// src/app/api/seller/[tenant]/members/route.ts
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

    const q = request.nextUrl.searchParams.get("q") ?? "";
    const summaryOnly = request.nextUrl.searchParams.get("summaryOnly") ?? "";

    const path =
        `/v1/seller/members?q=${encodeURIComponent(q)}` +
        (summaryOnly === "1" ? "&summaryOnly=1" : "");

    const result = await fetchBackend(request, tenant, path);

    return NextResponse.json(
        result.data ?? {
            ok: false,
            message: "members fetch failed",
        },
        {
            status: result.status || 500,
        }
    );
}