// src/app/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getApiBase() {
    return (
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:4000"
    ).replace(/\/+$/, "");
}

function getHeaderFirst(req: NextRequest, key: string) {
    return (req.headers.get(key) || "").split(",")[0].trim();
}

function getForwardedProto(req: NextRequest) {
    return getHeaderFirst(req, "x-forwarded-proto").toLowerCase();
}

function getForwardedHost(req: NextRequest) {
    return getHeaderFirst(req, "x-forwarded-host") || getHeaderFirst(req, "host");
}

function isDevHttp(req: NextRequest) {
    const host = (getForwardedHost(req) || "").toLowerCase();
    const proto = getForwardedProto(req) || req.nextUrl.protocol.replace(":", "");
    return proto === "http" || host.includes(":3000");
}

function isLikelyLocalHost(host: string) {
    const h = (host || "").split(",")[0].trim().toLowerCase();
    const hostOnly = h.split(":")[0];
    if (!hostOnly) return true;
    if (hostOnly === "localhost") return true;
    if (hostOnly.endsWith(".localhost")) return true;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly)) return true;
    return false;
}

function cookieDomainForShare(req: NextRequest) {
    const host = (getForwardedHost(req) || "").split(",")[0].trim();
    if (isLikelyLocalHost(host)) return undefined;
    return process.env.COOKIE_DOMAIN || ".zpzp.kr";
}

function parseSessionCookieName(rawSetCookie: string | null) {
    if (!rawSetCookie) return null;

    const firstCookie = rawSetCookie.split(/,(?=\s*[^;=]+=[^;]+)/g)[0] || "";
    const firstPart = firstCookie.split(";")[0] || "";
    const eqIndex = firstPart.indexOf("=");

    if (eqIndex < 0) return null;

    const name = firstPart.slice(0, eqIndex).trim();
    return name || null;
}

function clearCookie(
    res: NextResponse,
    name: string,
    req: NextRequest,
    options?: { httpOnly?: boolean }
) {
    const dev = isDevHttp(req);
    const secure = dev ? false : true;
    const sameSite = secure ? ("none" as const) : ("lax" as const);
    const domain = cookieDomainForShare(req);

    res.cookies.set(name, "", {
        httpOnly: options?.httpOnly ?? true,
        path: "/",
        sameSite,
        secure,
        domain,
        maxAge: 0,
    });
}

async function handleLogout(req: NextRequest) {
    const tenant = req.nextUrl.searchParams.get("tenant") || "a";
    const authOrigin =
        process.env.NEXT_PUBLIC_AUTH_ORIGIN ||
        process.env.AUTH_ORIGIN ||
        `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    const returnTo = new URL(
        `/login?tenant=${encodeURIComponent(tenant)}&returnTo=/home&loggedOut=1`,
        authOrigin
    ).toString();

    const backendRes = await fetch(`${getApiBase()}/v1/auth/logout`, {
        method: "POST",
        headers: {
            accept: "application/json",
            cookie: req.headers.get("cookie") || "",
            ...(req.headers.get("x-forwarded-host")
                ? { "x-forwarded-host": req.headers.get("x-forwarded-host") as string }
                : {}),
            ...(req.headers.get("x-forwarded-proto")
                ? { "x-forwarded-proto": req.headers.get("x-forwarded-proto") as string }
                : {}),
        },
        cache: "no-store",
        redirect: "manual",
    });

    const sessionCookieName =
        parseSessionCookieName(backendRes.headers.get("set-cookie")) || "dad_admin_sid";

    if (req.method === "GET") {
        const res = NextResponse.redirect(returnTo, { status: 302 });

        clearCookie(res, sessionCookieName, req, { httpOnly: true });
        clearCookie(res, "selectedTenant", req, { httpOnly: true });

        return res;
    }

    const payload = await backendRes.json().catch(() => ({ ok: backendRes.ok }));

    const res = NextResponse.json(payload, {
        status: backendRes.status,
    });

    clearCookie(res, sessionCookieName, req, { httpOnly: true });
    clearCookie(res, "selectedTenant", req, { httpOnly: true });

    return res;
}

export async function GET(req: NextRequest) {
    return handleLogout(req);
}

export async function POST(req: NextRequest) {
    return handleLogout(req);
}