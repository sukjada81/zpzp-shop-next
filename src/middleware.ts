// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * ----------------------------
 * 0️⃣ Global routes (tenant prefix 금지)
 * ----------------------------
 */
function isGlobalRoute(pathname: string) {
    return (
        pathname === "/select-tenant" ||
        pathname.startsWith("/select-tenant/") ||
        pathname === "/login" ||
        pathname.startsWith("/login/") ||
        // ✅ 통합 관리자: /admin은 전역 라우트 (Host rewrite 금지)
        pathname === "/admin" ||
        pathname.startsWith("/admin/")
    );
}

function isAdminPublicRoute(pathname: string) {
    // ✅ 관리자 로그인 페이지는 인증 없이 접근 가능해야 함
    return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

/**
 * ----------------------------
 * 1️⃣ Host 기반 tenant rewrite
 * ----------------------------
 */
function getSubdomain(host: string) {
    const h = host.split(":")[0].toLowerCase();
    if (h === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return null;
    const parts = h.split(".");
    if (parts.length < 3) return null;
    return parts[0];
}

function isPublicAsset(pathname: string) {
    return (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon.ico") ||
        pathname.startsWith("/robots.txt") ||
        pathname.startsWith("/sitemap.xml")
    );
}

function isPublicPath(pathname: string) {
    if (pathname.startsWith("/_next")) return true;
    if (pathname === "/favicon.ico") return true;
    if (pathname.startsWith("/api")) return true; // API는 서버에서 auth 체크 권장
    return false;
}

function needsAuth(pathname: string) {
    const siteProtected = /^\/[^/]+\/(home|cart|order|orders)(\/|$)/;
    const sellerProtected = /^\/seller\/[^/]+\/(products|orders)(\/|$)/;

    // ✅ 통합 관리자 보호
    const adminProtected = /^\/admin(\/|$)/;

    return siteProtected.test(pathname) || sellerProtected.test(pathname) || adminProtected.test(pathname);
}

function extractTenant(pathname: string) {
    const segs = pathname.split("/").filter(Boolean);
    if (segs[0] === "seller") return segs[1] || "";
    return segs[0] || "";
}

export function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;

    // A. 정적 리소스 제외
    if (isPublicAsset(pathname)) return NextResponse.next();

    // A-1. 글로벌 라우트는 tenant rewrite 금지
    if (isGlobalRoute(pathname)) {
        // 단, /admin/login 은 auth 제외로만 처리하고 그대로 통과
        return NextResponse.next();
    }

    // B. Host 기반 rewrite (운영용)
    const host = req.headers.get("host") ?? "";
    const subdomain = getSubdomain(host);
    if (subdomain) {
        const seg = pathname.split("/").filter(Boolean)[0];
        if (seg !== subdomain) {
            const url = req.nextUrl.clone();
            url.pathname = `/${subdomain}${pathname}`;
            url.search = search;
            return NextResponse.rewrite(url);
        }
    }

    // C. public path 통과
    if (isPublicPath(pathname)) return NextResponse.next();

    // D. 인증 필요 여부
    if (!needsAuth(pathname)) return NextResponse.next();

    // ✅ 관리자 로그인 페이지는 공개
    if (isAdminPublicRoute(pathname)) return NextResponse.next();

    // 개발용 mockLogin
    const mockLogin = req.cookies.get("mockLogin")?.value === "1";
    if (mockLogin) return NextResponse.next();

    // ✅ 통합 admin은 /admin/login 으로 보냄
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
        const loginUrl = req.nextUrl.clone();
        loginUrl.pathname = "/admin/login";
        loginUrl.searchParams.set("returnTo", `${pathname}${search || ""}`);
        return NextResponse.redirect(loginUrl);
    }

    // site/seller 기존 tenant 기반 로그인
    const tenant = extractTenant(pathname);

    let returnTo = "/home";
    if (tenant) {
        const prefix1 = `/${tenant}`;
        const prefix2 = `/seller/${tenant}`;

        if (pathname.startsWith(prefix2)) {
            const rest = pathname.slice(prefix2.length) || "/home";
            const normalized = rest.startsWith("/") ? rest : `/${rest}`;
            returnTo = `/seller/${tenant}${normalized}`;
        } else if (pathname.startsWith(prefix1)) {
            const rest = pathname.slice(prefix1.length) || "/home";
            returnTo = rest.startsWith("/") ? rest : `/${rest}`;
        }
    }

    const returnToWithQuery = `${returnTo}${search || ""}`;
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = tenant ? `/${tenant}/login` : `/login`;
    loginUrl.searchParams.set("returnTo", returnToWithQuery);
    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};