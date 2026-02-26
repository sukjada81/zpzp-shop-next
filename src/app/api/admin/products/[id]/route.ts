// src/app/api/admin/products/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

function baseApi() {
    return process.env.API_BASE_URL || "http://127.0.0.1:4000";
}

// 숫자만 남기는 안전 파서 (예: "1\nundefined" -> "1")
function normalizeId(raw: unknown) {
    const s = String(raw ?? "").trim();
    const m = s.match(/\d+/);
    return m ? m[0] : "";
}

export async function GET(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
    const resolved = await Promise.resolve(ctx.params);
    const id = normalizeId(resolved?.id);

    if (!id) return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });

    const cookie = (await headers()).get("cookie") || "";
    const upstream = new URL(`/admin/products/${id}`, baseApi());

    const res = await fetch(upstream.toString(), {
        method: "GET",
        headers: { cookie },
        cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
}

export async function PUT(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
    const resolved = await Promise.resolve(ctx.params);
    const id = normalizeId(resolved?.id);

    if (!id) return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });

    const cookie = (await headers()).get("cookie") || "";
    const body = await req.text();

    const upstream = new URL(`/admin/products/${id}`, baseApi());

    const res = await fetch(upstream.toString(), {
        method: "PUT",
        headers: { cookie, "content-type": "application/json" },
        body,
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
}