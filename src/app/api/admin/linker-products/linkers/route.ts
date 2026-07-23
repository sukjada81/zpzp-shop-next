import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

function baseApi() {
    return process.env.API_BASE_URL || "http://127.0.0.1:4000";
}

async function proxy(req: NextRequest, upstreamPath: string) {
    const cookie = (await headers()).get("cookie") || "";
    const url = new URL(upstreamPath, baseApi());
    req.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));

    const res = await fetch(url.toString(), {
        method: "GET",
        headers: { cookie, accept: "application/json" },
        cache: "no-store",
    });

    const data = await res.json().catch(() => ({ ok: false }));
    return NextResponse.json(data, { status: res.status });
}

export async function GET(req: NextRequest) {
    return proxy(req, "/admin/linker-products/linkers");
}
