import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000";

/**
 * Next(Node) 환경에서는 Response.headers에 getSetCookie()가 있을 수도 있고 없을 수도 있습니다.
 * - 있으면 string[]로 안전하게 가져오고
 * - 없으면 set-cookie 단일 헤더를 fallback으로 사용합니다.
 */
function getSetCookies(upstream: Response): string[] {
    const headers = upstream.headers as Headers & {
        getSetCookie?: () => string[];
    };

    if (typeof headers.getSetCookie === "function") {
        return headers.getSetCookie().filter(Boolean);
    }

    const single = upstream.headers.get("set-cookie");
    return single ? [single] : [];
}

function appendSetCookieHeaders(res: NextResponse, upstream: Response) {
    for (const sc of getSetCookies(upstream)) {
        res.headers.append("set-cookie", sc);
    }
}

function buildTargetUrl(pathParts: string[], req: NextRequest) {
    // /api/proxy/[...path]
    // 예) /api/proxy/a/v1/public/page.tsx -> http://localhost:4000/a/v1/public/products
    const path = pathParts.join("/");
    const url = new URL(`${API_BASE.replace(/\/$/, "")}/${path}`);
    url.search = req.nextUrl.search; // query 전달
    return url;
}

function toUpstreamHeaders(req: NextRequest) {
    // hop-by-hop 헤더 정리 + host 제거
    const headers = new Headers(req.headers);
    headers.delete("host");
    headers.delete("content-length");

    // 보통 프록시 캐시 방지
    headers.set("cache-control", "no-store");
    return headers;
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
    const { path } = await ctx.params;

    // ✅ 라우트 확인용(선택)
    // /api/proxy/ping -> ok
    if (path.length === 1 && path[0] === "ping") {
        return NextResponse.json({ ok: true, ping: "pong" }, { status: 200 });
    }

    const target = buildTargetUrl(path, req);

    const method = req.method.toUpperCase();
    const hasBody = !["GET", "HEAD"].includes(method);
    const body = hasBody ? await req.arrayBuffer() : undefined;

    const upstream = await fetch(target.toString(), {
        method,
        headers: toUpstreamHeaders(req),
        body,
        redirect: "manual",
    });

    const resBody = await upstream.arrayBuffer();

    // content-type은 upstream 것을 우선 사용
    const res = new NextResponse(resBody, {
        status: upstream.status,
        headers: {
            "content-type": upstream.headers.get("content-type") || "application/octet-stream",
            "cache-control": "no-store",
        },
    });

    // ✅ upstream set-cookie 전달 (Node API가 세션 쿠키 내려주는 경우 대비)
    appendSetCookieHeaders(res, upstream);

    return res;
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