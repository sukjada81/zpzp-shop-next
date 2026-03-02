// src/app/api/admin/tenants/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

function baseApi() {
    return process.env.API_BASE_URL || "http://127.0.0.1:4000";
}

// ✅ Next.js 16 대응: params가 Promise로 들어오는 케이스가 있어 union 처리
type Ctx = { params: { id: string } | Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
    const cookie = (await headers()).get("cookie") || "";
    const { id } = await Promise.resolve(ctx.params);

    const upstream = new URL(`/admin/v1/tenants/${encodeURIComponent(id)}`, baseApi());
    const res = await fetch(upstream.toString(), {
        method: "GET",
        headers: { cookie, accept: "application/json" },
        cache: "no-store",
    });

    const data = await res.json().catch(() => ({ ok: false }));
    return NextResponse.json(data, { status: res.status });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
    const cookie = (await headers()).get("cookie") || "";
    const { id } = await Promise.resolve(ctx.params);
    const body = await req.json().catch(() => ({}));

    const upstream = new URL(`/admin/v1/tenants/${encodeURIComponent(id)}`, baseApi());
    const res = await fetch(upstream.toString(), {
        method: "PUT",
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