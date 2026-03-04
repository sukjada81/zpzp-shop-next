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

    // ✅ 0) auth 서브도메인은 middleware가 redirect/rewrite 하지 않고 Next 라우트로 넘긴다.
    // - auth 루트(/) → /login 처리, returnTo 처리 등은 src/app/page.tsx(및 로그인 페이지)에서 담당
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

        // "/" 또는 "/index"류는 내부 선택화면으로
        if (pathname === "/") {
            const url = req.nextUrl.clone();
            url.pathname = "/select-tenant";
            url.search = search;
            return NextResponse.rewrite(url);
        }

        // 선택화면 경로는 그대로 통과
        if (pathname === "/select-tenant" || pathname.startsWith("/select-tenant/")) {
            return NextResponse.next();
        }

        // 그 외는 루트로 정리(원하면 404로 둬도 됨)
        const toRoot = req.nextUrl.clone();
        toRoot.pathname = "/";
        toRoot.search = "";
        return NextResponse.redirect(toRoot);
    }

    // =========================
    // 2) Admin 보호 (기존 유지)
    // =========================
    if (isAdminPath(pathname)) {
        if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
            return NextResponse.next();
        }

        try {
            const sessionUrl = new URL("/api/admin/session", req.nextUrl.origin);
            const res = await fetch(sessionUrl.toString(), {
                headers: { cookie: req.headers.get("cookie") || "" },
                cache: "no-store",
            });

            if (!res.ok) {
                const loginUrl = req.nextUrl.clone();
                loginUrl.pathname = "/admin/login";
                loginUrl.searchParams.set("returnTo", `${pathname}${search || ""}`);
                return NextResponse.redirect(loginUrl);
            }

            return NextResponse.next();
        } catch {
            const loginUrl = req.nextUrl.clone();
            loginUrl.pathname = "/admin/login";
            loginUrl.searchParams.set("returnTo", `${pathname}${search || ""}`);
            return NextResponse.redirect(loginUrl);
        }
    }

    const ENABLE_SUBDOMAIN_TENANT = process.env.TENANT_BY_SUBDOMAIN === "1";
    const subdomain = ENABLE_SUBDOMAIN_TENANT ? getSubdomain(host) : null;

    // ✅ main/auth 등에서는 tenant rewrite 자체를 하지 않는다.
    if (!subdomain) return NextResponse.next();

    // tenant 서브도메인에서 전역 라우트는 bypass
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
            const url = req.nextUrl.clone();
            url.pathname = internalPathname;
            url.search = search;
            return NextResponse.rewrite(url);
        }
        return NextResponse.next();
    }

    const mockLogin = req.cookies.get("mockLogin")?.value === "1";
    if (mockLogin) {
        if (internalPathname !== pathname) {
            const url = req.nextUrl.clone();
            url.pathname = internalPathname;
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