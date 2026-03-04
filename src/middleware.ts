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
 * ✅ rewrite는 "내부 라우팅(로컬 origin)" 으로만 해야 안전함.
 * - 외부 https 절대 URL로 rewrite하면 Next가 내부 프록시/페치하다가 SSL 체인 문제로 500 나는 케이스가 많음.
 */
function makeInternalRewriteUrl(req: NextRequest, pathname: string, search: string) {
    const url = req.nextUrl.clone(); // 내부 origin(대부분 http://127.0.0.1:3000)
    url.pathname = pathname;
    url.search = search || "";
    return url;
}

/**
 * ✅ redirect는 사용자 브라우저가 따라갈 "외부 origin" 이 필요.
 * (localhost로 굳는 현상 방지)
 */
function getExternalOrigin(req: NextRequest) {
    const proto = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim() || "http";
    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
        .split(",")[0]
        .trim();
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
    // => "/" 요청은 "/select-tenant"로 "내부 rewrite" (URL은 "/" 유지)
    // =========================
    if (host.startsWith("select-tenant.")) {
        if (isPublicPath(pathname)) return NextResponse.next();

        if (pathname === "/") {
            // ✅ 내부 rewrite로 변경 (외부 https로 rewrite 금지)
            return NextResponse.rewrite(makeInternalRewriteUrl(req, "/select-tenant", search));
        }

        if (pathname === "/select-tenant" || pathname.startsWith("/select-tenant/")) {
            return NextResponse.next();
        }

        // 그 외는 루트로 정리(redirect는 외부 origin)
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
            // ✅ 세션 체크는 같은 호스트로 내부 호출하지 말고,
            // 외부 절대URL(브라우저 기준)이 아닌 "내부 origin"으로 호출하는 게 안전.
            // 다만 여기서는 /api/admin/session 이 Next route handler라 내부 origin이어도 OK.
            const internalSessionUrl = new URL("/api/admin/session", req.nextUrl.origin);

            const res = await fetch(internalSessionUrl.toString(), {
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
            // ✅ 내부 rewrite로 변경 (외부 https 절대URL rewrite 금지)
            return NextResponse.rewrite(makeInternalRewriteUrl(req, internalPathname, search));
        }
        return NextResponse.next();
    }

    const mockLogin = req.cookies.get("mockLogin")?.value === "1";
    if (mockLogin) {
        if (internalPathname !== pathname) {
            // ✅ 내부 rewrite로 변경
            return NextResponse.rewrite(makeInternalRewriteUrl(req, internalPathname, search));
        }
        return NextResponse.next();
    }

    // ✅ 미로그인 → auth 도메인으로 보낸다. (redirect는 외부 origin/ENV 기준)
    const AUTH_ORIGIN = getEnvOrigin("AUTH");
    const SELECT_TENANT_ORIGIN = getEnvOrigin("SELECT_TENANT");

    const loginUrl = new URL("/login", AUTH_ORIGIN);
    loginUrl.searchParams.set("returnTo", new URL("/", SELECT_TENANT_ORIGIN).toString());

    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};