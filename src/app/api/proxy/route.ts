// src/app/api/_proxy/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Next(Node) 환경에서는 Response.headers에 getSetCookie()가 있을 수도 있고 없을 수도 있습니다.
 * - 있으면 string[]로 안전하게 가져오고
 * - 없으면 set-cookie 단일 헤더를 fallback으로 사용합니다.
 */
function getSetCookies(upstream: Response): string[] {
    // Response.headers는 표준 Headers 타입이지만, 런타임에 getSetCookie가 추가될 수 있음
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

async function handle(req: NextRequest) {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "/";

    // ✅ 라우트가 잡혔는지 확인용
    if (path === "/ping") {
        return NextResponse.json({ ok: true, ping: "pong" }, { status: 200 });
    }

    const PHP_BASE = process.env.PHP_API_BASE; // 예: http://localhost/legacy_api
    if (!PHP_BASE) {
        return NextResponse.json(
            { ok: false, error: "Missing env: PHP_API_BASE" },
            { status: 500 }
        );
    }

    // /auth/kakao/exchange 같은 path를 PHP_BASE 뒤에 붙임
    const target = new URL(PHP_BASE.replace(/\/$/, "") + path);

    // path 제외한 query string 전달 (선택)
    url.searchParams.forEach((v, k) => {
        if (k === "path") return;
        target.searchParams.set(k, v);
    });

    const method = req.method.toUpperCase();
    const hasBody = !["GET", "HEAD"].includes(method);
    const body = hasBody ? await req.arrayBuffer() : undefined;

    const headers: Record<string, string> = {
        accept: req.headers.get("accept") || "*/*",
        // GET인데 content-type이 빈 경우도 있으니 안전하게
        "content-type": req.headers.get("content-type") || "application/json",
        // ✅ PHP 세션 연동용 쿠키 전달
        cookie: req.headers.get("cookie") || "",
    };

    // 필요 시 auth 전달
    const auth = req.headers.get("authorization");
    if (auth) headers["authorization"] = auth;

    const upstream = await fetch(target.toString(), {
        method,
        headers,
        body, // ArrayBuffer | undefined
        redirect: "manual",
    });

    const resBody = await upstream.arrayBuffer();

    const res = new NextResponse(resBody, {
        status: upstream.status,
        headers: {
            "content-type":
                upstream.headers.get("content-type") || "application/octet-stream",
            "cache-control": "no-store",
        },
    });

    // ✅ PHP가 세션 Set-Cookie 내려주면 브라우저로 전달
    appendSetCookieHeaders(res, upstream);
    return res;
}

export async function GET(req: NextRequest) {
    return handle(req);
}
export async function POST(req: NextRequest) {
    return handle(req);
}
export async function PUT(req: NextRequest) {
    return handle(req);
}
export async function PATCH(req: NextRequest) {
    return handle(req);
}
export async function DELETE(req: NextRequest) {
    return handle(req);
}