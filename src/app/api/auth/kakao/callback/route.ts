// src/app/api/auth/kakao/callback/route.ts
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
            returnTo?: string; // 절대URL 또는 상대경로
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

function getForwardedProto(req: NextRequest) {
    return (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
}

function isHttpsRequest(req: NextRequest) {
    const xfProto = getForwardedProto(req);
    if (xfProto) return xfProto === "https";
    // fallback: nextUrl.protocol
    return req.nextUrl.protocol === "https:";
}

function isLikelyLocalHost(host: string) {
    const h = (host || "").split(",")[0].trim().toLowerCase();
    const hostOnly = h.split(":")[0];
    if (!hostOnly) return true;
    if (hostOnly === "localhost") return true;
    if (hostOnly.endsWith(".localhost")) return true;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly)) return true; // IP
    return false;
}

function safeTenantSlug(raw: string) {
    const t = (raw || "").trim().toLowerCase();
    // tenant는 알파/숫자/하이픈만 허용 (보안/오타 방지)
    if (!t) return "";
    if (!/^[a-z0-9-]+$/.test(t)) return "";
    return t;
}

function cookieDomainForShare(req: NextRequest) {
    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
    // 로컬(= localhost / IP 등)에서는 domain 지정하면 쿠키가 안 먹음
    if (isLikelyLocalHost(host)) return undefined;
    return process.env.COOKIE_DOMAIN || ".discountallday.kr";
}

function buildTenantOrigin(req: NextRequest, tenant: string) {
    const baseDomain = process.env.TENANT_BASE_DOMAIN || "discountallday.kr";

    // 운영은 항상 https 기준 (nginx 뒤에서 도는 구조)
    const proto = isHttpsRequest(req) ? "https" : "http";

    // 로컬에서만 포트 유지가 필요하면 env로 지정해서 사용
    // 예: LOCAL_TENANT_PORT=3000
    const localPort = process.env.LOCAL_TENANT_PORT || "";
    const portPart = proto === "http" && localPort ? `:${localPort}` : "";

    return `${proto}://${tenant}.${baseDomain}${portPart}`;
}

function safeNextUrl(req: NextRequest, returnTo: string, tenant: string) {
    const SELECT_TENANT_ORIGIN =
        process.env.SELECT_TENANT_ORIGIN || "https://select-tenant.discountallday.kr";
    const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://discountallday.kr";

    // 1) 절대 URL이면 그대로(단, 허용 도메인만 통과시키면 더 안전)
    if (isAbsoluteUrl(returnTo)) return returnTo;

    // 2) 상대경로면 tenant가 있으면 tenant origin 기준으로 붙임
    const path = returnTo.startsWith("/") ? returnTo : "/";
    if (tenant) return new URL(path, buildTenantOrigin(req, tenant)).toString();

    // 3) tenant 없으면 지점선택으로 보내는 게 기본
    //    (/select-tenant를 main이 아니라 select-tenant 서브도메인 루트로 보냄)
    if (path === "/select-tenant" || path === "/") {
        return new URL("/", SELECT_TENANT_ORIGIN).toString();
    }

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
    const returnTo =
        v.payload.returnTo ||
        (process.env.SELECT_TENANT_ORIGIN || "https://select-tenant.discountallday.kr") + "/";

    // code 없이 error로 돌아오는 케이스: 일반 로그인으로 재시도
    if (!code && err) {
        const AUTH_ORIGIN =
            process.env.AUTH_ORIGIN || process.env.MAIN_ORIGIN || "http://localhost:3000";
        const retry = new URL("/api/auth/kakao/login", AUTH_ORIGIN);
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

        const https = isHttpsRequest(req);

        // ✅ 운영(https): SameSite=None + Secure=true 권장
        // ✅ 로컬(http): Lax + Secure=false
        const sameSite = https ? ("none" as const) : ("lax" as const);
        const secure = https;

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