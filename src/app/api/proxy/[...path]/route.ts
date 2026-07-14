// src/app/api/proxy/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";

function baseApi() {
    return (process.env.API_BASE_URL || "http://127.0.0.1:4000").replace(/\/+$/, "");
}

function normalizeTenant(raw: unknown) {
    const t = String(raw ?? "").trim().toLowerCase();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

function getHost(req: NextRequest) {
    return (req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host || "")
        .split(",")[0]
        .trim()
        .toLowerCase();
}

function getHostOnly(host: string) {
    return (host || "").split(":")[0].trim().toLowerCase();
}

function isIp(hostOnly: string) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly);
}

function isTunnelDomain(hostOnly: string) {
    const h = hostOnly.toLowerCase();

    const blockedSuffixes = [
        "ngrok-free.dev",
        "ngrok-free.app",
        "ngrok.app",
        "ngrok.io",
        "trycloudflare.com",
        "loca.lt",
        "localtunnel.me",
    ];

    return blockedSuffixes.some((suffix) => h === suffix || h.endsWith(`.${suffix}`));
}

function isNonTenantServiceHost(hostOnly: string) {
    const h = (hostOnly || "").toLowerCase().trim();

    if (!h) return false;

    return (
        h === "localhost" ||
        h === "127.0.0.1" ||
        h === "auth.zpzp.kr" ||
        h === "select-tenant.zpzp.kr" ||
        h === "seller.zpzp.kr" ||
        h === "admin.zpzp.kr" ||
        h === "api.zpzp.kr" ||
        h === "www.zpzp.kr"
    );
}

function resolveTenantFromHost(hostOnly: string) {
    const h = (hostOnly || "").toLowerCase().trim();
    if (!h) return "";

    if (h === "localhost" || isIp(h) || isTunnelDomain(h) || isNonTenantServiceHost(h)) {
        return "";
    }

    const baseDomain = (process.env.TENANT_BASE_DOMAIN || "zpzp.kr")
        .toLowerCase()
        .trim();

    if (baseDomain) {
        if (h === baseDomain) return "";
        if (!h.endsWith(`.${baseDomain}`)) return "";

        const rest = h.slice(0, -(baseDomain.length + 1));
        const firstLabel = rest.split(".")[0] ?? "";
        return normalizeTenant(firstLabel);
    }

    const parts = h.split(".");
    if (parts.length >= 3) return normalizeTenant(parts[0]);

    return "";
}

function resolveTenantFromPath(path: string[]) {
    if (!Array.isArray(path) || path.length === 0) return "";

    // /api/proxy/v1/...
    const first = normalizeTenant(path[0]);
    if (!first) return "";

    // 백엔드 공용 prefix들은 tenant가 아님
    const reserved = new Set([
        "v1",
        "admin",
        "auth",
        "health",
        "uploads",
        "seller",
        "public",
    ]);

    if (reserved.has(first)) return "";

    return first;
}

function resolveTenant(req: NextRequest, path: string[]) {
    // 0) 명시 헤더 우선
    const tenantFromHeader = normalizeTenant(req.headers.get("x-tenant-slug"));
    if (tenantFromHeader) return tenantFromHeader;

    // 1) tenant subdomain 우선
    const hostOnly = getHostOnly(getHost(req));
    const tenantFromHost = resolveTenantFromHost(hostOnly);
    if (tenantFromHost) return tenantFromHost;

    // 2) proxy path fallback
    const tenantFromPath = resolveTenantFromPath(path);
    if (tenantFromPath) return tenantFromPath;

    // 3) selectedTenant 쿠키 fallback
    return normalizeTenant(req.cookies.get("selectedTenant")?.value || "");
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

function toUpstreamHeaders(req: NextRequest, path: string[]) {
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
    h.delete("host");

    h.set("x-forwarded-host", originalHost);
    h.set("x-forwarded-proto", originalProto);
    h.set("x-forwarded-port", req.nextUrl.port || (originalProto === "https" ? "443" : "80"));

    if (!h.get("accept")) h.set("accept", "application/json");

    const cookie = req.headers.get("cookie");
    if (cookie) {
        h.set("cookie", cookie);
    }

    const tenant = resolveTenant(req, path);
    if (tenant) {
        h.set("x-tenant-slug", tenant);
    } else {
        h.delete("x-tenant-slug");
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
    const tenant = resolveTenant(req, path);

    const method = req.method.toUpperCase();
    const hasBody = method !== "GET" && method !== "HEAD";
    const body = hasBody ? await req.arrayBuffer() : undefined;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    let upstream: Response;
    try {
        upstream = await fetch(upstreamUrl.toString(), {
            method,
            headers: toUpstreamHeaders(req, path),
            body,
            cache: "no-store",
            redirect: "manual",
            signal: controller.signal,
        });
    } catch (err: any) {
        clearTimeout(timeout);
        const isTimeout = err?.name === "AbortError";
        return NextResponse.json(
            { ok: false, error: isTimeout ? "API_TIMEOUT" : "API_UNREACHABLE" },
            { status: 502 }
        );
    } finally {
        clearTimeout(timeout);
    }

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