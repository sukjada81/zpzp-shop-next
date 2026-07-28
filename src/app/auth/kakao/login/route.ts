// src/app/auth/kakao/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

function base64url(input: Buffer | string) {
    return Buffer.from(input)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function signState(payload: Record<string, unknown>, secret: string) {
    const json = JSON.stringify(payload);
    const encoded = base64url(json);
    const sig = crypto.createHmac("sha256", secret).update(json).digest();
    return `${encoded}.${base64url(sig)}`;
}

function safeTenantSlug(raw: string) {
    const t = String(raw || "").trim().toLowerCase();
    if (!t) return "";
    if (!/^[a-z0-9-]+$/.test(t)) return "";
    return t;
}

/**
 * tenant 를 서브도메인으로 조립하면 안 되는 슬러그(middleware.ts RESERVED_SUBDOMAINS 와 동일).
 * hq 가 대표 사례 — 링커 스토어의 라우트 tenant 가 hq 라서 https://hq.zpzp.kr/home 이
 * 만들어지면 404 다. callback/route.ts 에 같은 목록이 있다(두 라우트가 각각 URL 을 만든다).
 */
const NON_TENANT_SLUGS = new Set([
    "www",
    "admin",
    "auth",
    "api",
    "select-tenant",
    "seller",
    "hq",
]);

function isNonTenantSlug(tenant: string) {
    const t = (tenant || "").trim().toLowerCase();
    return !t || NON_TENANT_SLUGS.has(t);
}

function buildTenantHome(originProtocol: string, tenant: string) {
    // 서브도메인으로 세울 수 없는 슬러그면 점포 선택으로 보낸다.
    if (isNonTenantSlug(tenant)) {
        return process.env.SELECT_TENANT_ORIGIN || "https://select-tenant.zpzp.kr";
    }

    const baseDomain = process.env.TENANT_BASE_DOMAIN || "zpzp.kr";
    const port =
        process.env.NEXT_PUBLIC_LOCAL_TENANT_PORT ||
        process.env.LOCAL_TENANT_PORT ||
        "";

    const isLocal = originProtocol === "http:";
    const portPart = isLocal && port ? `:${port}` : "";

    return `${originProtocol}//${tenant}.${baseDomain}${portPart}/home`;
}

export async function GET(req: NextRequest) {
    const kakaoClientId = process.env.KAKAO_CLIENT_ID || "";
    const authOrigin = process.env.AUTH_ORIGIN || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const authStateSecret = process.env.AUTH_STATE_SECRET || "";

    if (!kakaoClientId || !authStateSecret) {
        return NextResponse.json(
            { ok: false, error: "Missing KAKAO_CLIENT_ID or AUTH_STATE_SECRET" },
            { status: 500 }
        );
    }

    // DAD 잔재였던 하드코딩 기본값 "a" 제거 — 존재하지 않는 점포다.
    // 빈 값이면 buildTenantHome 이 점포 선택으로 폴백한다.
    const tenant =
        safeTenantSlug(req.nextUrl.searchParams.get("tenant") || "") ||
        safeTenantSlug(req.cookies.get("selectedTenant")?.value || "");

    const defaultReturnTo = buildTenantHome(req.nextUrl.protocol, tenant);
    const returnTo = req.nextUrl.searchParams.get("returnTo") || defaultReturnTo;

    const auto = req.nextUrl.searchParams.get("auto") || "0";

    const redirectUri = new URL("/auth/kakao/callback", authOrigin).toString();

    const state = signState(
        {
            tenant,
            returnTo,
            nonce: crypto.randomUUID(),
            ts: Date.now(),
        },
        authStateSecret
    );

    const authorizeUrl = new URL("https://kauth.kakao.com/oauth/authorize");
    authorizeUrl.searchParams.set("client_id", kakaoClientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("state", state);

    authorizeUrl.searchParams.set(
        "scope",
        ["profile_nickname", "profile_image", "account_email"].join(" ")
    );

    if (auto === "1") {
        authorizeUrl.searchParams.set("prompt", "none");
    } else {
        authorizeUrl.searchParams.set("prompt", "login");
    }

    return NextResponse.redirect(authorizeUrl.toString(), { status: 302 });
}