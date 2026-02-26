// src/app/api/admin/dashboard/route.ts
    import { NextResponse } from "next/server";

function baseApi() {
    return process.env.API_BASE_URL || "http://127.0.0.1:4000";
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const tenant = url.searchParams.get("tenant") || "all";

    const upstream = new URL("/admin/dashboard", baseApi());
    upstream.searchParams.set("tenant", tenant);

    const cookie = req.headers.get("cookie") || "";

    const res = await fetch(upstream, {
        method: "GET",
        headers: { cookie },
        cache: "no-store",
    });

    const data = await res.json().catch(() => ({ ok: false }));
    return NextResponse.json(data, { status: res.status });
}