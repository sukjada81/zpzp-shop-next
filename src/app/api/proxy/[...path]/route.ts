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

/**
 * ✅ 프록시 환경에서 쿠키 저장 실패 방지:
 * - Domain=... 제거 (Host-only cookie)
 * - SameSite 없으면 Lax
 * - SameSite=None이면 Secure 강제
 */
function normalizeSetCookie(sc: string, req: NextRequest) {
    let out = sc;

    // 1) Domain=... 제거
    out = out.replace(/;\s*Domain=[^;]+/gi, "");

    // 2) Path 없으면 /
    if (!/;\s*Path=/i.test(out)) out += "; Path=/";

    // 3) SameSite 없으면 Lax
    if (!/;\s*SameSite=/i.test(out)) out += "; SameSite=Lax";

    // 4) SameSite=None이면 Secure 필수
    const hasNone = /;\s*SameSite=None/i.test(out);

    const proto =
        req.headers.get("x-forwarded-proto") ||
        (req.nextUrl.protocol ? req.nextUrl.protocol.replace(":", "") : "http");

    const isHttps = proto === "https";

    if (hasNone && !/;\s*Secure/i.test(out)) {
        out += "; Secure";
    }

    // https일 때 None이면 Secure 보강(중복 방지)
    if (isHttps && hasNone && !/;\s*Secure/i.test(out)) {
        out += "; Secure";
    }

    return out;
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
    const { path } = await ctx.params;

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

    const buf = await upstream.arrayBuffer();

    const outHeaders = new Headers();
    const ct = upstream.headers.get("content-type");
    if (ct) outHeaders.set("content-type", ct);

    for (const c of getSetCookies(upstream)) {
        outHeaders.append("set-cookie", normalizeSetCookie(c, req));
    }

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