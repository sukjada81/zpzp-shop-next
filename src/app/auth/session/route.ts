// src/app/auth/session/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getApiBase() {
    return (
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:4000"
    ).replace(/\/+$/, "");
}

export async function GET(req: NextRequest) {
    const res = await fetch(`${getApiBase()}/v1/auth/session`, {
        method: "GET",
        headers: {
            accept: "application/json",
            cookie: req.headers.get("cookie") || "",
        },
        cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    return NextResponse.json({
        ok: true,
        loggedIn: Boolean(data?.loggedIn),
        member: data?.member ?? null,
        tenant: data?.member?.tenantSlug ?? req.cookies.get("selectedTenant")?.value ?? "",
    });
}