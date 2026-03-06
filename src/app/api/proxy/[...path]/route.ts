// src/app/api/proxy/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";

function baseApi() {
    return process.env.API_BASE_URL || "http://127.0.0.1:4000";
}

/** hop-by-hop 헤더 제거 + 필요한 헤더만 전달 */
function toUpstreamHeaders(req: NextRequest) {
    const h = new Headers(req.headers);

    h.delete("host");
    h.delete("connection");
    h.delete("content-length");

    if (!h.get("accept")) h.set("accept", "application/json");

    // ⭐ 세션 쿠키 전달 (핵심)
    const cookie = req.headers.get("cookie");
    if (cookie) {
        h.set("cookie", cookie);
    }

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
 * - Path 없으면 /
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

    // x-forwarded-proto 우선 (프록시 환경)
    const proto =
        (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim() ||
        (req.nextUrl.protocol ? req.nextUrl.protocol.replace(":", "") : "http");

    const isHttps = proto === "https";

    if (hasNone && !/;\s*Secure/i.test(out)) out += "; Secure";
    if (isHttps && hasNone && !/;\s*Secure/i.test(out)) out += "; Secure";

    return out;
}

/** Next route handler: ctx.params가 Promise/동기 혼재 가능 → 둘 다 커버 */
async function getPathParams(ctx: any): Promise<string[]> {
    const rawParams = await Promise.resolve(ctx?.params);
    const path = rawParams?.path;
    if (Array.isArray(path)) return path.map(String);
    return [];
}

async function handle(req: NextRequest, ctx: any) {
    const path = await getPathParams(ctx);
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

    /**
     * ✅ 업스트림 헤더를 가능한 많이 보존
     * - 단, hop-by-hop / 길이 관련은 제거
     * - set-cookie는 normalize 해서 다시 append
     */
    const outHeaders = new Headers(upstream.headers);
    outHeaders.delete("content-length"); // NextResponse가 알아서 처리
    outHeaders.delete("connection");
    outHeaders.delete("transfer-encoding");

    // set-cookie는 정규화 필요 → 기존 제거 후 append
    outHeaders.delete("set-cookie");
    for (const c of getSetCookies(upstream)) {
        outHeaders.append("set-cookie", normalizeSetCookie(c, req));
    }

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
export async function OPTIONS(req: NextRequest, ctx: any) {
    return handle(req, ctx);
}