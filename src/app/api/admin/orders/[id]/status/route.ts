// src/app/api/admin/orders/[id]/status/route.ts
import { NextResponse } from "next/server";

function baseApi() {
    return process.env.API_BASE_URL || "http://127.0.0.1:4000";
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;

    const upstream = new URL(`/admin/orders/${encodeURIComponent(id)}/status`, baseApi());
    const cookie = req.headers.get("cookie") || "";
    const body = await req.text();

    const res = await fetch(upstream, {
        method: "PATCH",
        headers: {
            cookie,
            "Content-Type": req.headers.get("content-type") || "application/json",
            Accept: "application/json",
        },
        body,
        cache: "no-store",
    });

    const data = await res.json().catch(() => ({ ok: false }));
    return NextResponse.json(data, { status: res.status });
}