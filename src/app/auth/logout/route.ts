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
    return !hostOnly || hostOnly === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly);
}

function cookieDomainForShare(req: NextRequest) {
    const host = (getForwardedHost(req) || "").split(",")[0].trim();
    if (isLikelyLocalHost(host)) return undefined;
    return process.env.COOKIE_DOMAIN || ".discountallday.kr";
}

function parseSessionCookie(rawSetCookie: string | null) {
    if (!rawSetCookie) return null;
    const firstPart = rawSetCookie.split(";")[0] || "";
    const eqIndex = firstPart.indexOf("=");
    if (eqIndex < 0) return null;

    const name = firstPart.slice(0, eqIndex).trim();
    return name || null;
}

export async function GET(req: NextRequest) {
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
            cookie: req.headers.get("cookie") || "",
        },
        cache: "no-store",
        redirect: "manual",
    });

    const backendSetCookie = backendRes.headers.get("set-cookie");
    const sessionCookieName = parseSessionCookie(backendSetCookie) || "dad_admin_sid";

    const res = NextResponse.redirect(returnTo, { status: 302 });

    const dev = isDevHttp(req);
    const secure = dev ? false : true;
    const sameSite = secure ? ("none" as const) : ("lax" as const);
    const domain = cookieDomainForShare(req);

    res.cookies.set(sessionCookieName, "", {
        httpOnly: true,
        path: "/",
        sameSite,
        secure,
        domain,
        maxAge: 0,
    });

    res.cookies.set("selectedTenant", "", {
        httpOnly: true,
        path: "/",
        sameSite,
        secure,
        domain,
        maxAge: 0,
    });

    return res;
}