import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function safeTenant(t: string) {
    if (!t) return "";
    const v = t.trim().toLowerCase();
    if (v === "undefined" || v === "null") return "";
    return v;
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
    if (proto === "http") return true;
    if (host.includes(":3000")) return true;
    return false;
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
    return process.env.COOKIE_DOMAIN || ".discountallday.kr";
}

function getAuthOrigin() {
    return process.env.AUTH_ORIGIN || process.env.MAIN_ORIGIN || "http://localhost:3000";
}

function buildTenantOrigin(req: NextRequest, tenant: string) {
    const baseDomain = process.env.TENANT_BASE_DOMAIN || "discountallday.kr";
    const dev = isDevHttp(req);

    const proto = dev ? "http" : "https";
    const localPort = process.env.LOCAL_TENANT_PORT || "3000";
    const portPart = dev ? `:${localPort}` : "";

    return `${proto}://${tenant}.${baseDomain}${portPart}`;
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const tenant = safeTenant(url.searchParams.get("tenant") || "");

    const returnToAbs = tenant ? new URL("/home", buildTenantOrigin(req, tenant)).toString() : "/";

    const AUTH_ORIGIN = getAuthOrigin();
    const loginUrl = new URL("/login", AUTH_ORIGIN);
    if (tenant) loginUrl.searchParams.set("tenant", tenant);
    loginUrl.searchParams.set("returnTo", returnToAbs);

    const res = NextResponse.redirect(loginUrl, { status: 302 });

    const dev = isDevHttp(req);
    const secure = dev ? false : true;
    const sameSite = secure ? ("none" as const) : ("lax" as const);
    const domain = cookieDomainForShare(req);

    const kill = (name: string) => {
        res.cookies.set(name, "", {
            httpOnly: true,
            path: "/",
            maxAge: 0,
            sameSite,
            secure,
            domain,
        });
    };

    kill("mockLogin");
    kill("mockTenant");
    kill("selectedTenant");

    return res;
}