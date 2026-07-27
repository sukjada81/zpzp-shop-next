import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

function baseApi() {
    return process.env.API_BASE_URL || "http://127.0.0.1:4000";
}

export async function GET(
    _req: NextRequest,
    context: { params: Promise<{ linkerUid: string }> | { linkerUid: string } }
) {
    const resolved = await Promise.resolve(context.params);
    const linkerUid = resolved?.linkerUid;
    const cookie = (await headers()).get("cookie") || "";
    const upstream = new URL(`/admin/linker-products/linkers/${encodeURIComponent(linkerUid)}/products`, baseApi());

    const res = await fetch(upstream.toString(), {
        method: "GET",
        headers: { cookie, accept: "application/json" },
        cache: "no-store",
    });

    const data = await res.json().catch(() => ({ ok: false }));
    return NextResponse.json(data, { status: res.status });
}
