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
 * ✅ ngrok/프록시 환경에서 쿠키가 저장되지 않는 가장 흔한 원인:
 * - Set-Cookie에 Domain=localhost / 127.0.0.1 등이 들어있으면
 *   ngrok 도메인에서 브라우저가 쿠키 저장을 거부함.
 *
 * 그래서 proxy에서 Set-Cookie를 "현재 호스트에 맞게" 정규화한다.
 * - Domain=... 제거 (Host-only cookie로 만듦)
 * - SameSite 없으면 Lax 기본
 * - SameSite=None 이면 Secure 강제(현대 브라우저 요구)
 */
function normalizeSetCookie(sc: string, req: NextRequest) {
    let out = sc;

    // 1) Domain=... 제거 (가장 중요)
    out = out.replace(/;\s*Domain=[^;]+/gi, "");

    // 2) Path 없으면 / (대부분 있겠지만 안전)
    if (!/;\s*Path=/i.test(out)) out += "; Path=/";

    // 3) SameSite 없으면 Lax 기본
    if (!/;\s*SameSite=/i.test(out)) out += "; SameSite=Lax";

    // 4) SameSite=None 이면 Secure 필수
    const hasNone = /;\s*SameSite=None/i.test(out);

    const proto =
        req.headers.get("x-forwarded-proto") ||
        (req.nextUrl.protocol ? req.nextUrl.protocol.replace(":", "") : "http");

    const isHttps = proto === "https";

    if (hasNone && !/;\s*Secure/i.test(out)) {
        // None인데 Secure가 없으면 브라우저가 차단
        out += "; Secure";
    }

    // 5) https 접속일 때, 쿠키에 Secure가 있어도 OK (없어도 되지만 문제는 아님)
    //    반대로 http(localhost)에서 Secure가 있으면 쿠키가 안 저장될 수 있음.
    //    => 여기서는 "https일 때만 Secure를 추가" 정도만 하고,
    //       기존 Secure는 건드리지 않는다(백엔드 정책 존중).
    if (isHttps && !/;\s*Secure/i.test(out) && hasNone) {
        // (이미 위에서 처리되지만 중복 방지용)
        out += "; Secure";
    }

    return out;
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

    // 중요: 세션 쿠키 전달(정규화해서 전달)
    for (const c of getSetCookies(upstream)) {
        outHeaders.append("set-cookie", normalizeSetCookie(c, req));
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