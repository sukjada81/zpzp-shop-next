// src/app/auth/kakao/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
console.log("KAKAO_CALLBACK_BUILD_MARK_20260316_v1");
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
    if (sigBuf.length !== expected.length) {
        return { ok: false as const, error: "INVALID_STATE_SIG" };
    }
    if (!crypto.timingSafeEqual(sigBuf, expected)) {
        return { ok: false as const, error: "INVALID_STATE_SIG" };
    }

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
    return process.env.COOKIE_DOMAIN || ".discountallday.kr";
}

function safeTenantSlug(raw: string) {
    const t = (raw || "").trim().toLowerCase();
    if (!t) return "";
    if (!/^[a-z0-9-]+$/.test(t)) return "";
    return t;
}

function buildTenantOrigin(req: NextRequest, tenant: string) {
    const baseDomain = process.env.TENANT_BASE_DOMAIN || "discountallday.kr";
    const dev = isDevHttp(req);
    const proto = dev ? "http" : "https";
    const localPort =
        process.env.NEXT_PUBLIC_LOCAL_TENANT_PORT ||
        process.env.LOCAL_TENANT_PORT ||
        "3000";
    const portPart = dev ? `:${localPort}` : "";
    return `${proto}://${tenant}.${baseDomain}${portPart}`;
}

function safeNextUrl(req: NextRequest, returnTo: string, tenant: string) {
    if (isAbsoluteUrl(returnTo)) return returnTo;
    const path = returnTo.startsWith("/") ? returnTo : "/home";
    return new URL(path, buildTenantOrigin(req, tenant)).toString();
}

async function exchangeKakaoToken(code: string, redirectUri: string) {
    const clientId = process.env.KAKAO_CLIENT_ID || "";
    const clientSecret = process.env.KAKAO_CLIENT_SECRET || "";

    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("client_id", clientId);
    body.set("redirect_uri", redirectUri);
    body.set("code", code);

    if (clientSecret) {
        body.set("client_secret", clientSecret);
    }

    const res = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        body,
        cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.access_token) {
        throw new Error(data?.error_description || data?.error || "KAKAO_TOKEN_FAILED");
    }

    return data;
}

async function fetchKakaoProfile(accessToken: string) {
    const res = await fetch("https://kapi.kakao.com/v2/user/me", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "content-type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.id) {
        throw new Error("KAKAO_PROFILE_FAILED");
    }

    return data;
}

function getApiBase() {
    return (
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:4000"
    ).replace(/\/+$/, "");
}

function parseSessionCookie(rawSetCookie: string | null) {
    if (!rawSetCookie) return null;

    const firstPart = rawSetCookie.split(";")[0] || "";
    const eqIndex = firstPart.indexOf("=");
    if (eqIndex < 0) return null;

    const name = firstPart.slice(0, eqIndex).trim();
    const rawValue = firstPart.slice(eqIndex + 1).trim();
    if (!name || !rawValue) return null;

    let value = rawValue;

    try {
        // 백엔드 Set-Cookie 값은 이미 encode 되어 있을 수 있으므로 1회 decode
        value = decodeURIComponent(rawValue);
    } catch {
        value = rawValue;
    }

    return { name, value };
}

export async function GET(req: NextRequest) {
    console.log("KAKAO_CALLBACK_ROUTE_HIT", req.nextUrl.toString());

    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const error = req.nextUrl.searchParams.get("error");
    const errorDescription = req.nextUrl.searchParams.get("error_description");

    console.log("KAKAO_CALLBACK_QUERY", {
        code,
        state,
        error,
        errorDescription,
    });

    return NextResponse.json({
        ok: true,
        code,
        state,
        error,
        errorDescription,
    });
}