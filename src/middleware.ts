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
 */
function makeInternalRewriteUrl(req: NextRequest, pathname: string, search: string) {
    const url = req.nextUrl.clone(); // 내부 origin(대부분 http://127.0.0.1:3000)
    url.pathname = pathname;
    url.search = search || "";
    return url;
}

/**
 * ✅ redirect는 사용자 브라우저가 따라갈 "외부 origin" 이 필요.
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
    // 0.5) admin 서브도메인 처리
    // - 외부 URL: https://admin.discountallday.kr/login, /dashboard, /orders ...
    // - 내부 라우트: /admin/login, /admin/dashboard, /admin/orders ...
    // - 세션 체크: /api/admin/session (Next route handler)
    // =========================
    if (host.startsWith("admin.")) {
        if (isPublicPath(pathname)) return NextResponse.next();

        // 외부에서 "/" 오면 대시보드로 (URL은 /dashboard로 정리)
        if (pathname === "/") {
            return NextResponse.redirect(new URL("/dashboard", externalOrigin));
        }

        // 외부 경로를 내부 /admin prefix로 매핑
        const adminExternalPath = pathname; // /login, /dashboard, /orders ...
        const adminInternalPath =
            adminExternalPath.startsWith("/admin/")
                ? adminExternalPath
                : `/admin${adminExternalPath}`;

        // 로그인 페이지는 통과 + 내부 rewrite
        if (adminExternalPath === "/login" || adminExternalPath.startsWith("/login/")) {
            if (adminInternalPath !== pathname) {
                return NextResponse.rewrite(makeInternalRewriteUrl(req, adminInternalPath, search));
            }
            return NextResponse.next();
        }

        // 혹시 기존 /admin/login 으로 들어와도 허용
        if (adminInternalPath === "/admin/login" || adminInternalPath.startsWith("/admin/login/")) {
            if (adminInternalPath !== pathname) {
                return NextResponse.rewrite(makeInternalRewriteUrl(req, adminInternalPath, search));
            }
            return NextResponse.next();
        }

        // ✅ 세션 체크
        try {
            const internalSessionUrl = new URL("/api/admin/session", req.nextUrl.origin);
            const res = await fetch(internalSessionUrl.toString(), {
                headers: { cookie: req.headers.get("cookie") || "" },
                cache: "no-store",
            });

            if (!res.ok) {
                const loginUrl = new URL("/login", externalOrigin);
                loginUrl.searchParams.set("returnTo", `${adminExternalPath}${search || ""}`);
                return NextResponse.redirect(loginUrl);
            }

            // 로그인됨 → 내부 rewrite
            if (adminInternalPath !== pathname) {
                return NextResponse.rewrite(makeInternalRewriteUrl(req, adminInternalPath, search));
            }
            return NextResponse.next();
        } catch {
            const loginUrl = new URL("/login", externalOrigin);
            loginUrl.searchParams.set("returnTo", `${adminExternalPath}${search || ""}`);
            return NextResponse.redirect(loginUrl);
        }
    }

    // =========================
    // 1) select-tenant 서브도메인 처리
    // =========================
    if (host.startsWith("select-tenant.")) {
        if (isPublicPath(pathname)) return NextResponse.next();

        if (pathname === "/") {
            return NextResponse.rewrite(makeInternalRewriteUrl(req, "/select-tenant", search));
        }

        if (pathname === "/select-tenant" || pathname.startsWith("/select-tenant/")) {
            return NextResponse.next();
        }

        return NextResponse.redirect(new URL("/", externalOrigin));
    }

    // =========================
    // 2) 기존 /admin path 보호 (호환 유지)
    // - 메인도메인/admin을 완전히 안 쓸 거면 나중에 제거해도 됨
    // =========================
    if (isAdminPath(pathname)) {
        if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
            return NextResponse.next();
        }

        try {
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

    const isProtected = needsAuth(internalPathname);
    if (!isProtected) {
        if (internalPathname !== pathname) {
            return NextResponse.rewrite(makeInternalRewriteUrl(req, internalPathname, search));
        }
        return NextResponse.next();
    }

    const mockLogin = req.cookies.get("mockLogin")?.value === "1";
    if (mockLogin) {
        if (internalPathname !== pathname) {
            return NextResponse.rewrite(makeInternalRewriteUrl(req, internalPathname, search));
        }
        return NextResponse.next();
    }

    const AUTH_ORIGIN = getEnvOrigin("AUTH");
    const SELECT_TENANT_ORIGIN = getEnvOrigin("SELECT_TENANT");

    const loginUrl = new URL("/login", AUTH_ORIGIN);
    loginUrl.searchParams.set("returnTo", new URL("/", SELECT_TENANT_ORIGIN).toString());

    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};