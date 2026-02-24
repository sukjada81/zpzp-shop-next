// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * ----------------------------
 * 0️⃣ Global routes (tenant prefix 금지)
 * ----------------------------
 * 방식 A(전역 계정 + 지점 선택)에서는
 * /select-tenant 같은 화면은 tenant(/b/...) 아래로 들어가면 안 됩니다.
 */
function isGlobalRoute(pathname: string) {
    // 필요 시 여기 추가
    return (
        pathname === "/select-tenant" ||
        pathname.startsWith("/select-tenant/") ||
        pathname === "/login" ||
        pathname.startsWith("/login/")
    );
}

/**
 * ----------------------------
 * 1️⃣ Host 기반 tenant rewrite
 * ----------------------------
 */

function getSubdomain(host: string) {
    const h = host.split(":")[0].toLowerCase();

    // localhost / ip 는 제외
    if (h === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
        return null;
    }

    const parts = h.split(".");
    if (parts.length < 3) return null;

    return parts[0]; // a.example.com -> a
}

function isPublicAsset(pathname: string) {
    return (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon.ico") ||
        pathname.startsWith("/robots.txt") ||
        pathname.startsWith("/sitemap.xml")
    );
}

/**
 * ----------------------------
 * 2️⃣ 기존 로직 (auth 관련)
 * ----------------------------
 */

function isPublicPath(pathname: string) {
    if (pathname.startsWith("/_next")) return true;
    if (pathname === "/favicon.ico") return true;
    if (pathname.startsWith("/api")) return true;
    return false;
}

function needsAuth(pathname: string) {
    const siteProtected = /^\/[^/]+\/(home|cart|order|orders)(\/|$)/;
    const sellerProtected = /^\/seller\/[^/]+\/(products|orders)(\/|$)/;
    return siteProtected.test(pathname) || sellerProtected.test(pathname);
}

function extractTenant(pathname: string) {
    const segs = pathname.split("/").filter(Boolean);
    if (segs[0] === "seller") return segs[1] || "";
    return segs[0] || "";
}

/**
 * ----------------------------
 * 3️⃣ Middleware Entry
 * ----------------------------
 */

export function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;

    // --------
    // A. 정적 리소스 제외
    // --------
    if (isPublicAsset(pathname)) {
        return NextResponse.next();
    }

    // ✅ A-1. 글로벌 라우트는 tenant rewrite 금지
    // (b.example.com/select-tenant 를 /b/select-tenant 로 바꾸면 안됨)
    if (isGlobalRoute(pathname)) {
        return NextResponse.next();
    }

    // --------
    // B. Host 기반 rewrite (운영용)
    // --------
    const host = req.headers.get("host") ?? "";
    const subdomain = getSubdomain(host);

    if (subdomain) {
        const seg = pathname.split("/").filter(Boolean)[0];

        // 이미 /{tenant}/... 형태면 skip
        if (seg !== subdomain) {
            const url = req.nextUrl.clone();
            url.pathname = `/${subdomain}${pathname}`;
            url.search = search;
            return NextResponse.rewrite(url);
        }
    }

    // --------
    // C. 기존 public path 통과
    // --------
    if (isPublicPath(pathname)) {
        return NextResponse.next();
    }

    // --------
    // D. 인증 필요 여부
    // --------
    if (!needsAuth(pathname)) {
        return NextResponse.next();
    }

    const mockLogin = req.cookies.get("mockLogin")?.value === "1";
    if (mockLogin) {
        return NextResponse.next();
    }

    const tenant = extractTenant(pathname);

    let returnTo = "/home";
    if (tenant) {
        const prefix1 = `/${tenant}`;
        const prefix2 = `/seller/${tenant}`;

        if (pathname.startsWith(prefix2)) {
            const rest = pathname.slice(prefix2.length) || "/home";
            returnTo = rest.startsWith("/") ? rest : `/${rest}`;
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