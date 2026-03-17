// src/app/api/proxy/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";

function baseApi() {
    return process.env.API_BASE_URL || "http://127.0.0.1:4000";
}

function buildUpstreamUrl(path: string[], req: NextRequest) {
    const base = new URL(baseApi());
    const basePath = base.pathname.replace(/\/+$/, "");
    const joinedPath = path.join("/").replace(/^\/+/, "");

    base.pathname = `${basePath}/${joinedPath}`.replace(/\/{2,}/g, "/");
    base.search = "";

    req.nextUrl.searchParams.forEach((v, k) => {
        base.searchParams.set(k, v);
    });

    return base;
}

function toUpstreamHeaders(req: NextRequest) {
    const h = new Headers(req.headers);

    const originalHost =
        req.headers.get("x-forwarded-host") ||
        req.headers.get("host") ||
        req.nextUrl.host;

    const originalProto =
        req.headers.get("x-forwarded-proto") ||
        req.nextUrl.protocol.replace(":", "") ||
        "http";

    h.delete("connection");
    h.delete("content-length");

    // host는 직접 넘기지 않고 forwarded 계열로 전달
    h.delete("host");

    h.set("x-forwarded-host", originalHost);
    h.set("x-forwarded-proto", originalProto);
    h.set("x-forwarded-port", req.nextUrl.port || (originalProto === "https" ? "443" : "80"));

    if (!h.get("accept")) h.set("accept", "application/json");

    const cookie = req.headers.get("cookie");
    if (cookie) {
        h.set("cookie", cookie);
    }

    return h;
}

function getSetCookies(res: Response): string[] {
    const anyHeaders: any = res.headers as any;
    if (typeof anyHeaders.getSetCookie === "function") {
        return anyHeaders.getSetCookie();
    }

    const sc = res.headers.get("set-cookie");
    return sc ? [sc] : [];
}

function normalizeSetCookie(sc: string, req: NextRequest) {
    let out = sc;

    out = out.replace(/;\s*Domain=[^;]+/gi, "");

    if (!/;\s*Path=/i.test(out)) out += "; Path=/";
    if (!/;\s*SameSite=/i.test(out)) out += "; SameSite=Lax";

    const hasNone = /;\s*SameSite=None/i.test(out);
    const proto =
        (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim() ||
        (req.nextUrl.protocol ? req.nextUrl.protocol.replace(":", "") : "http");

    const isHttps = proto === "https";

    if (hasNone && !/;\s*Secure/i.test(out)) out += "; Secure";
    if (isHttps && hasNone && !/;\s*Secure/i.test(out)) out += "; Secure";

    return out;
}

async function getPathParams(ctx: any): Promise<string[]> {
    const rawParams = await Promise.resolve(ctx?.params);
    const path = rawParams?.path;
    if (Array.isArray(path)) return path.map(String);
    return [];
}

async function handle(req: NextRequest, ctx: any) {
    const path = await getPathParams(ctx);
    const upstreamUrl = buildUpstreamUrl(path, req);

    console.log("PROXY_BASE_API", baseApi());
    console.log("PROXY_UPSTREAM_URL", upstreamUrl.toString());
    console.log("PROXY_ORIGINAL_HOST", req.headers.get("host"));
    console.log("PROXY_FORWARDED_HOST", req.headers.get("x-forwarded-host"));

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

    const outHeaders = new Headers(upstream.headers);
    outHeaders.delete("content-length");
    outHeaders.delete("connection");
    outHeaders.delete("transfer-encoding");

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