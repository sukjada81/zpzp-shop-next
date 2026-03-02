// src/app/api/admin/points/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";

function baseApi() {
    return process.env.API_BASE_URL || "http://127.0.0.1:4000";
}

export async function GET(req: Request) {
    const cookie = (await headers()).get("cookie") || "";

    const url = new URL(req.url);
    const upstream = new URL("/admin/v1/points", baseApi());

    // querystring 그대로 전달 (tenant/page/pageSize/q/type 등)
    url.searchParams.forEach((value, key) => {
        upstream.searchParams.set(key, value);
    });

    const res = await fetch(upstream.toString(), {
        method: "GET",
        headers: {
            cookie,
            accept: "application/json",
        },
        cache: "no-store",
    });

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = { ok: false, raw: text };
    }

    return NextResponse.json(data, { status: res.status });
}