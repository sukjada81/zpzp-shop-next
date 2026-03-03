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

function cookieDomainForShare() {
    return process.env.COOKIE_DOMAIN || ".discountallday.kr";
}

function isAbsoluteUrl(s: string) {
    return /^https?:\/\//i.test(s);
}

function getProto(req: NextRequest) {
    const xfProto = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
    return xfProto || "http";
}

function getPortFromHost(host: string) {
    const m = host.match(/:(\d+)$/);
    return m ? m[1] : "";
}

function buildTenantOrigin(req: NextRequest, tenant: string) {
    const baseDomain = process.env.TENANT_BASE_DOMAIN || "discountallday.kr";
    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
    const port = getPortFromHost(host);
    const proto = getProto(req);
    const portPart = port ? `:${port}` : "";
    return `${proto}://${tenant}.${baseDomain}${portPart}`;
}

function safeNextUrl(req: NextRequest, returnTo: string, tenant: string) {
    const SITE_ORIGIN = process.env.SITE_ORIGIN || "http://localhost:3000";

    // 1) 절대 URL이면 그대로
    if (isAbsoluteUrl(returnTo)) return returnTo;

    // 2) 상대 경로인데 tenant가 있으면 tenant origin 기준으로 붙임 (핵심)
    const path = returnTo.startsWith("/") ? returnTo : "/select-tenant";
    if (tenant) {
        return new URL(path, buildTenantOrigin(req, tenant)).toString();
    }

    // 3) tenant 없으면 SITE_ORIGIN 기준
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

    const tenant = (v.payload.tenant || "").trim();
    const returnTo = v.payload.returnTo || (process.env.SITE_ORIGIN || "http://localhost:3000") + "/select-tenant";

    if (!code && err) {
        const AUTH_ORIGIN = process.env.AUTH_ORIGIN || process.env.MAIN_ORIGIN || "http://localhost:3000";
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
        const domain = cookieDomainForShare();
        const target = safeNextUrl(req, returnTo, tenant);

        const res = NextResponse.redirect(target, { status: 302 });

        res.cookies.set("mockLogin", "1", {
            httpOnly: true,
            path: "/",
            sameSite: "lax",
            secure: false, // 로컬 http 테스트면 false
            domain,
        });

        res.cookies.set("mockTenant", tenant, {
            httpOnly: true,
            path: "/",
            sameSite: "lax",
            secure: false,
            domain,
        });

        return res;
    }

    return NextResponse.json({ ok: false, error: "PHP_AUTH_NOT_CONNECTED_YET", tenant, returnTo }, { status: 501 });
}