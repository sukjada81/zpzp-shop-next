// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

function isPublicAsset(pathname: string) {
    return (
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico" ||
        pathname === "/robots.txt" ||
        pathname === "/sitemap.xml"
    );
}

function isPublicPath(pathname: string) {
    if (pathname.startsWith("/_next")) return true;
    if (pathname === "/favicon.ico") return true;
    if (pathname.startsWith("/api")) return true;
    return false;
}

function isAdminPath(pathname: string) {
    return pathname === "/admin" || pathname.startsWith("/admin/");
}

function needsAuth(pathname: string) {
    const siteProtected = /^\/[^/]+\/(home|cart|order|orders|goods|points|settings)(\/|$)/;
    const sellerProtected = /^\/seller\/[^/]+\/(products|orders)(\/|$)/;
    return siteProtected.test(pathname) || sellerProtected.test(pathname);
}

function getHost(req: NextRequest) {
    return (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
        .split(",")[0]
        .trim()
        .toLowerCase();
}

/**
 * ✅ 프록시 뒤에서 NextRequest.nextUrl이 localhost로 굳는 케이스가 있어서,
 * rewrite/redirect에 사용할 "외부 origin"을 헤더 기준으로 직접 만든다.
 */
function getExternalOrigin(req: NextRequest) {
    const proto = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim() || "http";
    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
        .split(",")[0]
        .trim();
    // host는 반드시 있어야 정상. 없으면 req.nextUrl.origin fallback
    if (!host) return req.nextUrl.origin;
    return `${proto}://${host}`;
}

function getSubdomain(host: string) {
    const h = host.split(":")[0].toLowerCase();
    if (!h) return null;

    if (h === "localhost") return null;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return null;

    const parts = h.split(".");
    if (parts.length < 3) return null;

    const sub = parts[0];

    // ✅ main/auth/admin/api/select-tenant 등은 tenant로 취급 금지
    if (["www", "admin", "auth", "api", "select-tenant", "discountallday"].includes(sub)) return null;

    return sub;
}

function getEnvOrigin(kind: "AUTH" | "SITE" | "SELECT_TENANT") {
    if (kind === "AUTH") {
        return process.env.AUTH_ORIGIN || process.env.MAIN_ORIGIN || "https://auth.discountallday.kr";
    }
    if (kind === "SELECT_TENANT") {
        return process.env.SELECT_TENANT_ORIGIN || "https://select-tenant.discountallday.kr";
    }
    return process.env.SITE_ORIGIN || "https://discountallday.kr";
}

export async function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;

    if (isPublicAsset(pathname)) return NextResponse.next();

    const host = getHost(req);
    const externalOrigin = getExternalOrigin(req);

    // ✅ 0) auth 서브도메인은 middleware에서 손대지 않는다.
    if (host.startsWith("auth.")) {
        return NextResponse.next();
    }

    // =========================
    // 1) select-tenant 서브도메인 처리
    // - 외부 URL: https://select-tenant.discountallday.kr/
    // - 내부 페이지: /select-tenant
    // => "/" 요청은 "/select-tenant"로 rewrite (URL은 "/" 유지)
    // =========================
    if (host.startsWith("select-tenant.")) {
        if (isPublicPath(pathname)) return NextResponse.next();

        if (pathname === "/") {
            // ✅ 절대 URL로 rewrite (localhost로 굳는 현상 방지)
            const url = new URL("/select-tenant", externalOrigin);
            url.search = search;
            return NextResponse.rewrite(url);
        }

        if (pathname === "/select-tenant" || pathname.startsWith("/select-tenant/")) {
            return NextResponse.next();
        }

        // 그 외는 루트로 정리
        return NextResponse.redirect(new URL("/", externalOrigin));
    }

    // =========================
    // 2) Admin 보호 (기존 유지)
    // =========================
    if (isAdminPath(pathname)) {
        if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
            return NextResponse.next();
        }

        try {
            const sessionUrl = new URL("/api/admin/session", externalOrigin);
            const res = await fetch(sessionUrl.toString(), {
                headers: { cookie: req.headers.get("cookie") || "" },
                cache: "no-store",
            });

            if (!res.ok) {
                const loginUrl = new URL("/admin/login", externalOrigin);
                loginUrl.searchParams.set("returnTo", `${pathname}${search || ""}`);
                return NextResponse.redirect(loginUrl);
            }

            return NextResponse.next();
        } catch {
            const loginUrl = new URL("/admin/login", externalOrigin);
            loginUrl.searchParams.set("returnTo", `${pathname}${search || ""}`);
            return NextResponse.redirect(loginUrl);
        }
    }

    const ENABLE_SUBDOMAIN_TENANT = process.env.TENANT_BY_SUBDOMAIN === "1";
    const subdomain = ENABLE_SUBDOMAIN_TENANT ? getSubdomain(host) : null;

    // ✅ main 등에서는 tenant rewrite 하지 않는다.
    if (!subdomain) return NextResponse.next();

    // tenant 서브도메인에서 전역 라우트 bypass
    if (
        pathname === "/login" ||
        pathname.startsWith("/login/") ||
        pathname === "/select-tenant" ||
        pathname.startsWith("/select-tenant/")
    ) {
        return NextResponse.next();
    }

    // 서브도메인 외부 URL: /home => 내부 라우트 /{tenant}/home 로 rewrite
    const externalPath = pathname === "/" ? "/home" : pathname;
    const firstSeg = externalPath.split("/").filter(Boolean)[0] || "";
    const alreadyPrefixed = firstSeg === subdomain;

    const bypass =
        externalPath.startsWith("/seller/") ||
        externalPath.startsWith("/api") ||
        externalPath.startsWith("/_next") ||
        externalPath === "/favicon.ico";

    const internalPathname = !alreadyPrefixed && !bypass ? `/${subdomain}${externalPath}` : externalPath;

    if (isPublicPath(pathname)) return NextResponse.next();

    // 보호 경로 아닐 때 rewrite만
    const isProtected = needsAuth(internalPathname);
    if (!isProtected) {
        if (internalPathname !== pathname) {
            const url = new URL(internalPathname, externalOrigin);
            url.search = search;
            return NextResponse.rewrite(url);
        }
        return NextResponse.next();
    }

    const mockLogin = req.cookies.get("mockLogin")?.value === "1";
    if (mockLogin) {
        if (internalPathname !== pathname) {
            const url = new URL(internalPathname, externalOrigin);
            url.search = search;
            return NextResponse.rewrite(url);
        }
        return NextResponse.next();
    }

    // ✅ 미로그인 → auth 도메인으로 보낸다.
    const AUTH_ORIGIN = getEnvOrigin("AUTH");
    const SELECT_TENANT_ORIGIN = getEnvOrigin("SELECT_TENANT");

    const loginUrl = new URL("/login", AUTH_ORIGIN);
    loginUrl.searchParams.set("returnTo", new URL("/", SELECT_TENANT_ORIGIN).toString());

    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};