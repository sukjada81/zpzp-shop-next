// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

function isGlobalRoute(pathname: string) {
    return (
        pathname === "/select-tenant" ||
        pathname.startsWith("/select-tenant/") ||
        pathname === "/login" ||
        pathname.startsWith("/login/") ||
        pathname === "/admin/login" || // ✅ admin login은 쉘/보호 제외
        pathname.startsWith("/admin/login/")
    );
}

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

// ✅ 통합 관리자 경로 여부
function isAdminPath(pathname: string) {
    return pathname === "/admin" || pathname.startsWith("/admin/");
}

export async function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;

    // A. 정적 리소스 제외
    if (isPublicAsset(pathname)) return NextResponse.next();

    // A-1. 글로벌 라우트는 tenant rewrite 금지
    if (isGlobalRoute(pathname)) return NextResponse.next();

    // ✅ A-2. 통합 admin은 tenant rewrite 금지 (host 기반 rewrite에 말려들면 안됨)
    if (isAdminPath(pathname)) {
        // ✅ /admin/login은 위에서 이미 통과
        // ✅ /admin/* 는 세션 체크 후 없으면 로그인으로
        const sessionCheckUrl = req.nextUrl.clone();
        sessionCheckUrl.pathname = "/api/admin/session";
        sessionCheckUrl.search = "";

        // 현재 요청의 cookie를 그대로 포함해서 내부 API 호출
        const res = await fetch(sessionCheckUrl, {
            headers: { cookie: req.headers.get("cookie") || "" },
        });

        if (!res.ok) {
            const loginUrl = req.nextUrl.clone();
            loginUrl.pathname = "/admin/login";
            loginUrl.searchParams.set("returnTo", `${pathname}${search || ""}`);
            return NextResponse.redirect(loginUrl);
        }

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

    // C. 기존 public path 통과
    if (isPublicPath(pathname)) return NextResponse.next();

    // D. 인증 필요 여부(tenant 앱/셀러)
    if (!needsAuth(pathname)) return NextResponse.next();

    const mockLogin = req.cookies.get("mockLogin")?.value === "1";
    if (mockLogin) return NextResponse.next();

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