// src/app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function safeTenant(t: string) {
    if (!t) return "";
    const v = t.trim().toLowerCase();
    if (v === "undefined" || v === "null") return "";
    return v;
}

function cookieDomainForShare() {
    return process.env.COOKIE_DOMAIN || ".discountallday.kr";
}

function getAuthOrigin() {
    // ✅ 로컬에서도 auth.discountallday.kr:3000 같은 걸 쓰면 여기로 고정됨
    return process.env.AUTH_ORIGIN || process.env.MAIN_ORIGIN || "http://localhost:3000";
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

    // 로컬 3000 붙여서 유지
    const portPart = port ? `:${port}` : "";
    return `${proto}://${tenant}.${baseDomain}${portPart}`;
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const tenant = safeTenant(url.searchParams.get("tenant") || "");

    // ✅ 핵심: returnTo를 상대경로로 넘기지 말고 "tenant 절대 URL"로 넘긴다
    // - tenant 있으면: http://a.discountallday.kr:3000/home
    // - tenant 없으면: 사이트 선택 화면(로컬은 localhost로 충분)
    const SITE_ORIGIN = process.env.SITE_ORIGIN || "http://localhost:3000";
    const returnToAbs = tenant
        ? new URL("/home", buildTenantOrigin(req, tenant)).toString()
        : new URL("/select-tenant", SITE_ORIGIN).toString();

    // ✅ 로그아웃 후 이동 도메인은 무조건 AUTH_ORIGIN
    const AUTH_ORIGIN = getAuthOrigin();
    const loginUrl = new URL("/login", AUTH_ORIGIN);
    if (tenant) loginUrl.searchParams.set("tenant", tenant);
    loginUrl.searchParams.set("returnTo", returnToAbs);

    const res = NextResponse.redirect(loginUrl, { status: 302 });

    // 쿠키 제거 (domain 일치 필수)
    const domain = cookieDomainForShare();

    res.cookies.set("mockLogin", "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: false, // 로컬 http 테스트면 false (https면 true로)
        domain,
    });

    res.cookies.set("mockTenant", "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: false,
        domain,
    });

    res.cookies.set("selectedTenant", "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: false,
        domain,
    });

    return res;
}