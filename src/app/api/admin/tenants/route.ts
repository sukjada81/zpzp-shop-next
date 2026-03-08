// src/app/api/admin/tenants/page.tsx
import { NextResponse } from "next/server";
import { headers } from "next/headers";

function baseApi() {
    return process.env.API_BASE_URL || "http://127.0.0.1:4000";
}

export async function GET(req: Request) {
    const cookie = (await headers()).get("cookie") || "";

    const upstream = new URL("/admin/v1/tenants", baseApi());

    const res = await fetch(upstream.toString(), {
        method: "GET",
        headers: { cookie, accept: "application/json" },
        cache: "no-store",
    });

    const data = await res.json().catch(() => ({ ok: false }));
    return NextResponse.json(data, { status: res.status });
}

export async function POST(req: Request) {
    const cookie = (await headers()).get("cookie") || "";
    const body = await req.json().catch(() => ({}));

    const upstream = new URL("/admin/v1/tenants", baseApi());
    const res = await fetch(upstream.toString(), {
        method: "POST",
        headers: {
            cookie,
            accept: "application/json",
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
    });

    const data = await res.json().catch(() => ({ ok: false }));
    return NextResponse.json(data, { status: res.status });
}