// src/app/api/proxy/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";

function baseApi() {
    return process.env.API_BASE_URL || "http://127.0.0.1:4000";
}

/** hop-by-hop 헤더 제거 + 필요한 헤더만 전달 */
function toUpstreamHeaders(req: NextRequest) {
    const h = new Headers(req.headers);

    // hop-by-hop / problematic
    h.delete("host");
    h.delete("connection");
    h.delete("content-length");

    // Accept 기본
    if (!h.get("accept")) h.set("accept", "application/json");

    return h;
}

function getSetCookies(res: Response): string[] {
    // undici(노드)에서는 getSetCookie 지원
    const anyHeaders: any = res.headers as any;
    if (typeof anyHeaders.getSetCookie === "function") {
        return anyHeaders.getSetCookie();
    }

    // fallback: 단일 set-cookie만 잡히는 환경 대응
    const sc = res.headers.get("set-cookie");
    return sc ? [sc] : [];
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
    const { path } = await ctx.params;

    // ex) /api/proxy/admin/auth/login -> path=["admin","auth","login"]
    const upstreamUrl = new URL(`/${path.join("/")}`, baseApi());

    // querystring 전달
    req.nextUrl.searchParams.forEach((v, k) => upstreamUrl.searchParams.set(k, v));

    const method = req.method.toUpperCase();
    const hasBody = method !== "GET" && method !== "HEAD";

    const body = hasBody ? await req.arrayBuffer() : undefined;

    const upstream = await fetch(upstreamUrl.toString(), {
        method,
        headers: toUpstreamHeaders(req),
        body,
        cache: "no-store",
        redirect: "manual",
    });

    // ✅ 응답 바디 그대로
    const buf = await upstream.arrayBuffer();

    // ✅ 응답 헤더 복사 (특히 set-cookie!)
    const outHeaders = new Headers();
    const ct = upstream.headers.get("content-type");
    if (ct) outHeaders.set("content-type", ct);

    // 중요: 세션 쿠키 전달
    for (const c of getSetCookies(upstream)) {
        outHeaders.append("set-cookie", c);
    }

    // 필요시 location도 전달(redirect 쓰는 경우)
    const loc = upstream.headers.get("location");
    if (loc) outHeaders.set("location", loc);

    return new NextResponse(buf, {
        status: upstream.status,
        headers: outHeaders,
    });
}

export async function GET(req: NextRequest, ctx: any) {
    return handle(req, ctx);
}
export async function POST(req: NextRequest, ctx: any) {
    return handle(req, ctx);
}
export async function PUT(req: NextRequest, ctx: any) {
    return handle(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: any) {
    return handle(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: any) {
    return handle(req, ctx);
}