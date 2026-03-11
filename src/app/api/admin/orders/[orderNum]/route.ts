// src/app/api/admin/orders/[orderNum]/route.ts
import { NextRequest, NextResponse } from "next/server";

function getApiBaseUrl() {
    return process.env.API_BASE_URL || "http://127.0.0.1:4000";
}

function forwardHeaders(req: NextRequest) {
    const headers = new Headers();
    const cookie = req.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);
    headers.set("accept", "application/json");
    return headers;
}

type RouteContext = {
    params: Promise<{
        orderNum: string;
    }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
    const { orderNum } = await context.params;

    if (!orderNum) {
        return NextResponse.json(
            { ok: false, message: "orderNum required" },
            { status: 400 }
        );
    }

    const upstreamUrl = new URL(
        `/admin/orders/${encodeURIComponent(orderNum)}`,
        getApiBaseUrl()
    );

    const res = await fetch(upstreamUrl.toString(), {
        method: "GET",
        headers: forwardHeaders(req),
        cache: "no-store",
    });

    const text = await res.text();

    return new NextResponse(text, {
        status: res.status,
        headers: {
            "content-type": res.headers.get("content-type") || "application/json; charset=utf-8",
        },
    });
}