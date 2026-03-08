// src/app/api/admin/products/page.tsx
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

function baseApi() {
    return process.env.API_BASE_URL || "http://127.0.0.1:4000";
}

export async function GET(req: NextRequest) {
    const cookie = (await headers()).get("cookie") || "";
    const url = new URL(req.url);

    const upstream = new URL("/admin/products", baseApi());
    url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));

    const res = await fetch(upstream.toString(), {
        method: "GET",
        headers: { cookie, accept: "application/json" },
        cache: "no-store",
    });

    const data = await res.json().catch(() => ({ ok: false }));
    return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
    const cookie = (await headers()).get("cookie") || "";
    const body = await req.text();

    const upstream = new URL("/admin/products", baseApi());

    const res = await fetch(upstream.toString(), {
        method: "POST",
        headers: {
            cookie,
            "content-type": "application/json",
            accept: "application/json",
        },
        body,
        cache: "no-store",
    });

    const data = await res.json().catch(() => ({ ok: false }));
    return NextResponse.json(data, { status: res.status });
}