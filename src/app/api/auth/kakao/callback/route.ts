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
            returnTo?: string;
            nonce?: string;
            ts?: number;
        };
        return { ok: true as const, payload };
    } catch {
        return { ok: false as const, error: "INVALID_STATE_PAYLOAD" };
    }
}

function isSafeReturnTo(path: string) {
    return path.startsWith("/") && !path.startsWith("//");
}

function getRequestOrigin(req: NextRequest) {
    const xfProto = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
    const xfHost = (req.headers.get("x-forwarded-host") || "").split(",")[0].trim();
    const host = (req.headers.get("host") || "").trim();

    const proto = xfProto || "http";
    const hostname = xfHost || host;

    if (!hostname) return "http://localhost:3000";
    return `${proto}://${hostname}`;
}

function buildTenantOrigin(req: NextRequest, tenant: string) {
    const isProd = process.env.NODE_ENV === "production";
    const BASE_DOMAIN = process.env.TENANT_BASE_DOMAIN || "discountallday.kr";

    if (isProd) {
        return `https://${tenant}.${BASE_DOMAIN}`;
    }

    // dev/local: 현재 요청 origin을 그대로 사용하되, host만 tenant로 바꿈
    // (로컬에서 hosts 설정 시: tenant.discountallday.kr -> 127.0.0.1)
    const origin = getRequestOrigin(req);
    const u = new URL(origin);
    u.hostname = `${tenant}.${BASE_DOMAIN}`;
    return u.toString().replace(/\/$/, "");
}

function cookieDomainForShare() {
    // 운영 공유 쿠키 도메인
    return process.env.COOKIE_DOMAIN || ".discountallday.kr";
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
    const returnTo = v.payload.returnTo || "/select-tenant";
    const safeReturnTo = isSafeReturnTo(returnTo) ? returnTo : "/select-tenant";

    const origin = getRequestOrigin(req);

    // code 없이 error로 돌아오는 케이스: 일반 로그인으로 재시도
    if (!code && err) {
        const retry = new URL("/api/auth/kakao/login", origin);
        if (tenant) retry.searchParams.set("tenant", tenant);
        retry.searchParams.set("returnTo", safeReturnTo);
        return NextResponse.redirect(retry, { status: 302 });
    }

    if (!code) {
        return NextResponse.json(
            {
                ok: false,
                error: "Missing code",
                hint: "Kakao returned no code. Check error params.",
                err,
                errDesc,
            },
            { status: 400 }
        );
    }

    // ✅ 프론트-only(MOCK_AUTH) 로그인 처리
    const MOCK_AUTH = process.env.MOCK_AUTH === "1";
    if (MOCK_AUTH) {
        const domain = cookieDomainForShare();

        // ✅ tenant 있으면 지점으로, 없으면 메인(/select-tenant)으로
        const targetUrl = tenant
            ? new URL(safeReturnTo, buildTenantOrigin(req, tenant))
            : new URL("/select-tenant", getRequestOrigin(req));

        const res = NextResponse.redirect(targetUrl, { status: 302 });

        res.cookies.set("mockLogin", "1", {
            httpOnly: true,
            path: "/",
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            domain,
        });

        res.cookies.set("mockTenant", tenant, {
            httpOnly: true,
            path: "/",
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            domain,
        });

        return res;
    }

    // ✅ (나중) 실제 인증 연동 단계
    return NextResponse.json(
        { ok: false, error: "PHP_AUTH_NOT_CONNECTED_YET", tenant, returnTo: safeReturnTo },
        { status: 501 }
    );
}