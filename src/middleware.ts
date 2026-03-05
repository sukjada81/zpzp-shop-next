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

/**
 * ✅ 보호 경로
 * - tenant 서브도메인에서 "/"도 보호로 취급
 */
function needsAuth(pathname: string) {
    if (pathname === "/" || pathname === "/home") return true;

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

function makeInternalRewriteUrl(req: NextRequest, pathname: string, search: string) {
    const INTERNAL_ORIGIN = process.env.NEXT_INTERNAL_ORIGIN || "http://127.0.0.1:3000";
    const url = new URL(pathname, INTERNAL_ORIGIN);
    url.search = search || "";
    return url;
}

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

function isLikelyLocalHost(host: string) {
    const h = (host || "").split(",")[0].trim().toLowerCase();
    const hostOnly = h.split(":")[0];
    if (!hostOnly) return true;
    if (hostOnly === "localhost") return true;
    if (hostOnly.endsWith(".localhost")) return true;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly)) return true; // IP
    // ✅ :3000 같은 개발 포트면 로컬 취급(현재 상황 반영)
    if (h.includes(":3000") || h.includes(":5173") || h.includes(":8080")) return true;
    return false;
}

function buildTenantHomeAbs(req: NextRequest, tenant: string) {
    const baseDomain = process.env.TENANT_BASE_DOMAIN || "discountallday.kr";

    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
    const proto = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim() || "http";

    const portMatch = host.match(/:(\d+)$/);
    const port = portMatch ? portMatch[1] : "";
    const portPart = proto === "http" && port ? `:${port}` : "";

    const httpsPreferred = !isLikelyLocalHost(host) && (process.env.AUTH_ORIGIN || "").startsWith("https://");
    const finalProto = httpsPreferred ? "https" : proto;

    return `${finalProto}://${tenant}.${baseDomain}${portPart}/home`;
}

async function hasAdminSession(req: NextRequest) {
    const internalOrigin = process.env.NEXT_INTERNAL_ORIGIN || "http://127.0.0.1:3000";
    const internalSessionUrl = new URL("/api/admin/session", internalOrigin);

    const res = await fetch(internalSessionUrl.toString(), {
        headers: { cookie: req.headers.get("cookie") || "" },
        cache: "no-store",
    });

    return res.ok;
}

export async function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;

    if (isPublicAsset(pathname)) return NextResponse.next();

    const host = getHost(req);
    const externalOrigin = getExternalOrigin(req);

    // =========================
    // ✅ 로컬 인증 우회 플래그
    // =========================
    const LOCAL_BYPASS_AUTH = process.env.LOCAL_BYPASS_AUTH === "1";
    const localLike = isLikelyLocalHost(host);
    const bypassAuth = LOCAL_BYPASS_AUTH && localLike;

    // ✅ auth 서브도메인은 건드리지 않음
    if (host.startsWith("auth.")) return NextResponse.next();

    // =========================
    // select-tenant 서브도메인
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
    // ✅ admin 서브도메인 (요구사항 반영 버전)
    // - 외부 URL: /login, /dashboard, /orders ...
    // - 내부 라우트: /admin/login, /admin/dashboard, /admin/orders ...
    // =========================
    if (host.startsWith("admin.")) {
        // 정적/내부 API는 그대로
        if (isPublicPath(pathname)) return NextResponse.next();

        // 1) 로그인 페이지는 항상 통과 + 내부 라우트로 rewrite
        if (pathname === "/login" || pathname.startsWith("/login/")) {
            return NextResponse.rewrite(makeInternalRewriteUrl(req, `/admin${pathname}`, search));
        }

        // 2) 내부 경로(/admin/...)로 직접 접근하는 경우도 허용(개발/디버깅)
        //    단, /admin/login은 예외로 무조건 통과
        if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
            return NextResponse.next();
        }

        // 3) 그 외는 세션 체크(로컬 우회면 통과)
        if (!bypassAuth) {
            try {
                const ok = await hasAdminSession(req);
                if (!ok) {
                    const loginUrl = new URL("/login", externalOrigin);
                    // returnTo는 "외부 URL" 기준으로 유지 (요구사항: /dashboard 등)
                    const returnTo = pathname === "/" ? "/dashboard" : `${pathname}${search || ""}`;
                    loginUrl.searchParams.set("returnTo", returnTo);
                    return NextResponse.redirect(loginUrl);
                }
            } catch {
                const loginUrl = new URL("/login", externalOrigin);
                const returnTo = pathname === "/" ? "/dashboard" : `${pathname}${search || ""}`;
                loginUrl.searchParams.set("returnTo", returnTo);
                return NextResponse.redirect(loginUrl);
            }
        }

        // 4) 로그인 상태면 rewrite 규칙 적용
        //    - "/" 또는 "/dashboard" -> "/admin/dashboard"
        //    - 나머지 "/xxx" -> "/admin/xxx"
        if (pathname === "/" || pathname === "/dashboard") {
            return NextResponse.rewrite(makeInternalRewriteUrl(req, "/admin/dashboard", search));
        }

        // 이미 /admin/...이면 그대로 next
        if (pathname === "/admin" || pathname.startsWith("/admin/")) {
            // "/admin" 루트로 들어오면 대시보드로 넘김
            if (pathname === "/admin") {
                return NextResponse.rewrite(makeInternalRewriteUrl(req, "/admin/dashboard", search));
            }
            return NextResponse.next();
        }

        // 일반 외부 페이지: /orders -> /admin/orders
        return NextResponse.rewrite(makeInternalRewriteUrl(req, `/admin${pathname}`, search));
    }

    // =========================
    // 내부 /admin 보호 (메인 도메인에서 /admin으로 들어오는 케이스)
    // =========================
    if (isAdminPath(pathname)) {
        if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
            return NextResponse.next();
        }

        // ✅ 로컬 인증 우회면 admin도 통과(원하면 제거 가능)
        if (bypassAuth) return NextResponse.next();

        try {
            const ok = await hasAdminSession(req);
            if (!ok) {
                const loginUrl = new URL("/login", externalOrigin);
                loginUrl.searchParams.set(
                    "returnTo",
                    pathname === "/admin" ? "/dashboard" : `${pathname}${search || ""}`
                );
                return NextResponse.redirect(loginUrl);
            }
            return NextResponse.next();
        } catch {
            const loginUrl = new URL("/login", externalOrigin);
            loginUrl.searchParams.set(
                "returnTo",
                pathname === "/admin" ? "/dashboard" : `${pathname}${search || ""}`
            );
            return NextResponse.redirect(loginUrl);
        }
    }

    // =========================
    // tenant 서브도메인 처리
    // =========================
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

    const mockLoginCookie = req.cookies.get("mockLogin")?.value === "1";
    const mockLogin = bypassAuth ? true : mockLoginCookie;

    const isProtected = needsAuth(internalPathname);

    // ✅ 디버그 헤더
    const addDebug = (res: NextResponse, action: string) => {
        res.headers.set("X-Dad-Debug-Action", action);
        res.headers.set("X-Dad-Debug-Host", host);
        res.headers.set("X-Dad-Debug-Sub", subdomain);
        res.headers.set("X-Dad-Debug-Path", pathname);
        res.headers.set("X-Dad-Debug-Internal", internalPathname);
        res.headers.set("X-Dad-Debug-Protected", String(isProtected));
        res.headers.set("X-Dad-Debug-Has-Mocklogin", String(!!req.cookies.get("mockLogin")?.value));
        res.headers.set("X-Dad-Debug-Has-Mocktenant", String(!!req.cookies.get("mockTenant")?.value));
        res.headers.set("X-Dad-Debug-Mocklogin", String(mockLogin));
        res.headers.set("X-Dad-Debug-BypassAuth", String(bypassAuth));
        return res;
    };

    // 보호 경로 아니면 rewrite/next
    if (!isProtected) {
        if (internalPathname !== pathname) {
            return addDebug(
                NextResponse.rewrite(makeInternalRewriteUrl(req, internalPathname, search)),
                "rewrite(unprotected)"
            );
        }
        return addDebug(NextResponse.next(), "next(unprotected)");
    }

    // 보호 경로 + 로그인(또는 로컬 우회)면 통과
    if (mockLogin) {
        if (internalPathname !== pathname) {
            return addDebug(
                NextResponse.rewrite(makeInternalRewriteUrl(req, internalPathname, search)),
                "rewrite(protected OK)"
            );
        }
        return addDebug(NextResponse.next(), "next(protected OK)");
    }

    // 보호 경로 + 미로그인 => auth로 이동 (운영용)
    const AUTH_ORIGIN = getEnvOrigin("AUTH");
    const loginUrl = new URL("/login", AUTH_ORIGIN);
    loginUrl.searchParams.set("tenant", subdomain);
    loginUrl.searchParams.set("returnTo", buildTenantHomeAbs(req, subdomain));

    return addDebug(
        NextResponse.redirect(loginUrl),
        "redirect(tenant protected -> auth/login)"
    );
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};