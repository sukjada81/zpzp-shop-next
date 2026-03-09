import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

function base64urlToBuffer(s: string) {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    return Buffer.from(b64 + pad, "base64");
}

function verifyState(state: string, secret: string) {
    const parts = state.split(".");
    if (parts.length !== 2) return { ok: false as const, error: "INVALID_STATE_FORMAT" };

    const payloadBuf = base64urlToBuffer(parts[0]);
    const sigBuf = base64urlToBuffer(parts[1]);

    const expected = crypto.createHmac("sha256", secret).update(payloadBuf).digest();
    if (sigBuf.length !== expected.length) return { ok: false as const, error: "INVALID_STATE_SIG" };
    if (!crypto.timingSafeEqual(sigBuf, expected)) return { ok: false as const, error: "INVALID_STATE_SIG" };

    try {
        const payload = JSON.parse(payloadBuf.toString("utf8")) as {
            tenant?: string;
            returnTo?: string;
            nonce?: string;
            ts?: number;
        };
        return { ok: true as const, payload };
    } catch {
        return { ok: false as const, error: "INVALID_STATE_PAYLOAD" };
    }
}

function isAbsoluteUrl(s: string) {
    return /^https?:\/\//i.test(s);
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

function safeTenantSlug(raw: string) {
    const t = (raw || "").trim().toLowerCase();
    if (!t) return "";
    if (!/^[a-z0-9-]+$/.test(t)) return "";
    return t;
}

function cookieDomainForShare(req: NextRequest) {
    const host = (getForwardedHost(req) || "").split(",")[0].trim();
    if (isLikelyLocalHost(host)) return undefined;
    return process.env.COOKIE_DOMAIN || ".discountallday.kr";
}

function buildTenantOrigin(req: NextRequest, tenant: string) {
    const baseDomain = process.env.TENANT_BASE_DOMAIN || "discountallday.kr";
    const dev = isDevHttp(req);

    const proto = dev ? "http" : "https";
    const localPort = process.env.LOCAL_TENANT_PORT || "3000";
    const portPart = dev ? `:${localPort}` : "";

    return `${proto}://${tenant}.${baseDomain}${portPart}`;
}

function normalizeReturnToToHome(req: NextRequest, returnTo: string, tenant: string) {
    if (isAbsoluteUrl(returnTo)) {
        try {
            const u = new URL(returnTo);
            if (u.pathname === "/" || u.pathname === "") {
                u.pathname = "/home";
                u.search = "";
                u.hash = "";
                return u.toString();
            }
            return u.toString();
        } catch {}
    }

    const path = returnTo?.startsWith("/") ? returnTo : "/";
    if ((path === "/" || path === "") && tenant) {
        return new URL("/home", buildTenantOrigin(req, tenant)).toString();
    }
    return returnTo;
}

function safeNextUrl(req: NextRequest, returnTo: string, tenant: string) {
    const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://discountallday.kr";

    if (isAbsoluteUrl(returnTo)) return returnTo;

    const path = returnTo.startsWith("/") ? returnTo : "/home";
    if (tenant) return new URL(path, buildTenantOrigin(req, tenant)).toString();

    return new URL(path, SITE_ORIGIN).toString();
}

export async function GET(req: NextRequest) {
    const url = req.nextUrl;
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    const err = url.searchParams.get("error");
    const errDesc = url.searchParams.get("error_description");

    if (!state) {
        return NextResponse.json({ ok: false, error: "Missing state" }, { status: 400 });
    }

    const AUTH_STATE_SECRET = process.env.AUTH_STATE_SECRET;
    if (!AUTH_STATE_SECRET) {
        return NextResponse.json({ ok: false, error: "Missing env: AUTH_STATE_SECRET" }, { status: 500 });
    }

    const v = verifyState(state, AUTH_STATE_SECRET);
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

    const tenant = safeTenantSlug(v.payload.tenant || "");
    const rawReturnTo = v.payload.returnTo || (tenant ? "/home" : "/");
    const returnTo = normalizeReturnToToHome(req, rawReturnTo, tenant);

    if (!code && err) {
        const AUTH_ORIGIN = process.env.AUTH_ORIGIN || process.env.MAIN_ORIGIN || "http://localhost:3000";
        const retry = new URL("/auth/kakao/login", AUTH_ORIGIN);
        if (tenant) retry.searchParams.set("tenant", tenant);
        retry.searchParams.set("returnTo", returnTo);
        retry.searchParams.set("auto", "0");
        return NextResponse.redirect(retry, { status: 302 });
    }

    if (!code) {
        return NextResponse.json({ ok: false, error: "Missing code", err, errDesc }, { status: 400 });
    }

    const MOCK_AUTH = process.env.MOCK_AUTH === "1";
    if (MOCK_AUTH) {
        const target = safeNextUrl(req, returnTo, tenant);
        const res = NextResponse.redirect(target, { status: 302 });

        const dev = isDevHttp(req);
        const secure = dev ? false : true;
        const sameSite = secure ? ("none" as const) : ("lax" as const);
        const domain = cookieDomainForShare(req);

        res.cookies.set("mockLogin", "1", {
            httpOnly: true,
            path: "/",
            sameSite,
            secure,
            domain,
        });

        res.cookies.set("mockTenant", tenant, {
            httpOnly: true,
            path: "/",
            sameSite,
            secure,
            domain,
        });

        return res;
    }

    return NextResponse.json(
        { ok: false, error: "PHP_AUTH_NOT_CONNECTED_YET", tenant, returnTo },
        { status: 501 }
    );
}