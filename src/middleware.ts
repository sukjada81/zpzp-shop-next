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
 * - (중요) 테넌트 서브도메인에서 "/"도 보호로 취급 (요구사항: 지점 접속 시 로그인 필요)
 */
function needsAuth(pathname: string) {
    // tenant 서브도메인 외부 루트도 로그인 필요
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

/**
 * ✅ rewrite는 내부 Next 서버로만 한다.
 */
function makeInternalRewriteUrl(req: NextRequest, pathname: string, search: string) {
    const INTERNAL_ORIGIN = process.env.NEXT_INTERNAL_ORIGIN || "http://127.0.0.1:3000";
    const url = new URL(pathname, INTERNAL_ORIGIN);
    url.search = search || "";
    return url;
}

/**
 * ✅ redirect는 외부 origin으로
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

    // tenant로 보면 안 되는 서브도메인
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
    return false;
}

/**
 * ✅ 로컬/dev에서는 http + :3000 유지, 운영은 https 고정
 * (callback/login에서 넘기는 returnTo를 정확히 만들기 위함)
 */
function buildTenantHomeAbs(req: NextRequest, tenant: string) {
    const baseDomain = process.env.TENANT_BASE_DOMAIN || "discountallday.kr";

    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
        .split(",")[0]
        .trim();
    const proto = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim() || "http";

    // 로컬이면 현재 포트 유지(:3000)
    const portMatch = host.match(/:(\d+)$/);
    const port = portMatch ? portMatch[1] : "";
    const portPart = proto === "http" && port ? `:${port}` : "";

    // 운영은 https (nginx)
    const httpsPreferred =
        !isLikelyLocalHost(host) && (process.env.AUTH_ORIGIN || "").startsWith("https://");
    const finalProto = httpsPreferred ? "https" : proto;

    return `${finalProto}://${tenant}.${baseDomain}${portPart}/home`;
}

/**
 * ✅ 디버그 로그/헤더 유틸
 * - cookie 원문은 찍지 않고, "mockLogin 존재 여부" 같은 최소정보만 남김
 * - 응답 헤더로도 확인 가능 (DevTools Network -> Response headers)
 */
function attachDebugHeaders(
    res: NextResponse,
    info: {
        host: string;
        pathname: string;
        subdomain: string | null;
        internalPathname?: string;
        isProtected?: boolean;
        mockLogin?: boolean;
        hasMockLoginCookie?: boolean;
        hasMockTenantCookie?: boolean;
        action: string;
        redirectTo?: string;
    }
) {
    // 서버 콘솔 로그
    console.log("[MW]", JSON.stringify(info));

    // 브라우저에서 확인용 헤더(짧게)
    res.headers.set("x-dad-debug-host", info.host);
    res.headers.set("x-dad-debug-path", info.pathname);
    res.headers.set("x-dad-debug-sub", info.subdomain ?? "");
    res.headers.set("x-dad-debug-protected", String(!!info.isProtected));
    res.headers.set("x-dad-debug-mocklogin", String(!!info.mockLogin));
    res.headers.set("x-dad-debug-has-mockLogin", String(!!info.hasMockLoginCookie));
    res.headers.set("x-dad-debug-has-mockTenant", String(!!info.hasMockTenantCookie));
    res.headers.set("x-dad-debug-action", info.action);
    if (info.internalPathname) res.headers.set("x-dad-debug-internal", info.internalPathname);
    if (info.redirectTo) res.headers.set("x-dad-debug-redirect", info.redirectTo);

    return res;
}

export async function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;

    if (isPublicAsset(pathname)) return NextResponse.next();

    const host = getHost(req);
    const externalOrigin = getExternalOrigin(req);

    // ✅ 공통 쿠키 체크(최소정보)
    const mockLoginCookie = req.cookies.get("mockLogin")?.value;
    const mockTenantCookie = req.cookies.get("mockTenant")?.value;
    const mockLogin = mockLoginCookie === "1";

    // ✅ auth 서브도메인은 건드리지 않음
    if (host.startsWith("auth.")) {
        const res = NextResponse.next();
        return attachDebugHeaders(res, {
            host,
            pathname,
            subdomain: null,
            isProtected: false,
            mockLogin,
            hasMockLoginCookie: !!mockLoginCookie,
            hasMockTenantCookie: !!mockTenantCookie,
            action: "next(auth-bypass)",
        });
    }

    // =========================
    // select-tenant 서브도메인
    // =========================
    if (host.startsWith("select-tenant.")) {
        if (isPublicPath(pathname)) {
            const res = NextResponse.next();
            return attachDebugHeaders(res, {
                host,
                pathname,
                subdomain: null,
                isProtected: false,
                mockLogin,
                hasMockLoginCookie: !!mockLoginCookie,
                hasMockTenantCookie: !!mockTenantCookie,
                action: "next(select-tenant public)",
            });
        }

        if (pathname === "/") {
            const res = NextResponse.rewrite(makeInternalRewriteUrl(req, "/select-tenant", search));
            return attachDebugHeaders(res, {
                host,
                pathname,
                subdomain: null,
                internalPathname: "/select-tenant",
                isProtected: false,
                mockLogin,
                hasMockLoginCookie: !!mockLoginCookie,
                hasMockTenantCookie: !!mockTenantCookie,
                action: "rewrite(select-tenant / -> /select-tenant)",
            });
        }

        if (pathname === "/select-tenant" || pathname.startsWith("/select-tenant/")) {
            const res = NextResponse.next();
            return attachDebugHeaders(res, {
                host,
                pathname,
                subdomain: null,
                isProtected: false,
                mockLogin,
                hasMockLoginCookie: !!mockLoginCookie,
                hasMockTenantCookie: !!mockTenantCookie,
                action: "next(select-tenant passthrough)",
            });
        }

        const red = new URL("/", externalOrigin).toString();
        const res = NextResponse.redirect(red);
        return attachDebugHeaders(res, {
            host,
            pathname,
            subdomain: null,
            isProtected: false,
            mockLogin,
            hasMockLoginCookie: !!mockLoginCookie,
            hasMockTenantCookie: !!mockTenantCookie,
            action: "redirect(select-tenant cleanup)",
            redirectTo: red,
        });
    }

    // =========================
    // admin 서브도메인
    // =========================
    if (host.startsWith("admin.")) {
        if (isPublicPath(pathname)) {
            const res = NextResponse.next();
            return attachDebugHeaders(res, {
                host,
                pathname,
                subdomain: null,
                isProtected: false,
                mockLogin,
                hasMockLoginCookie: !!mockLoginCookie,
                hasMockTenantCookie: !!mockTenantCookie,
                action: "next(admin public)",
            });
        }

        if (pathname === "/") {
            const res = NextResponse.rewrite(makeInternalRewriteUrl(req, "/admin/dashboard", search));
            return attachDebugHeaders(res, {
                host,
                pathname,
                subdomain: null,
                internalPathname: "/admin/dashboard",
                isProtected: false,
                mockLogin,
                hasMockLoginCookie: !!mockLoginCookie,
                hasMockTenantCookie: !!mockTenantCookie,
                action: "rewrite(admin / -> /admin/dashboard)",
            });
        }

        if (pathname === "/login" || pathname.startsWith("/login/")) {
            const res = NextResponse.rewrite(makeInternalRewriteUrl(req, `/admin${pathname}`, search));
            return attachDebugHeaders(res, {
                host,
                pathname,
                subdomain: null,
                internalPathname: `/admin${pathname}`,
                isProtected: false,
                mockLogin,
                hasMockLoginCookie: !!mockLoginCookie,
                hasMockTenantCookie: !!mockTenantCookie,
                action: "rewrite(admin /login -> /admin/login)",
            });
        }

        if (pathname === "/admin" || pathname.startsWith("/admin/")) {
            const res = NextResponse.next();
            return attachDebugHeaders(res, {
                host,
                pathname,
                subdomain: null,
                isProtected: false,
                mockLogin,
                hasMockLoginCookie: !!mockLoginCookie,
                hasMockTenantCookie: !!mockTenantCookie,
                action: "next(admin internal passthrough)",
            });
        }

        const res = NextResponse.rewrite(makeInternalRewriteUrl(req, `/admin${pathname}`, search));
        return attachDebugHeaders(res, {
            host,
            pathname,
            subdomain: null,
            internalPathname: `/admin${pathname}`,
            isProtected: false,
            mockLogin,
            hasMockLoginCookie: !!mockLoginCookie,
            hasMockTenantCookie: !!mockTenantCookie,
            action: "rewrite(admin catch-all)",
        });
    }

    // =========================
    // 내부 /admin 보호
    // =========================
    if (isAdminPath(pathname)) {
        if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
            const res = NextResponse.next();
            return attachDebugHeaders(res, {
                host,
                pathname,
                subdomain: null,
                isProtected: false,
                mockLogin,
                hasMockLoginCookie: !!mockLoginCookie,
                hasMockTenantCookie: !!mockTenantCookie,
                action: "next(admin login allowed)",
            });
        }

        try {
            const internalSessionUrl = new URL(
                "/api/admin/session",
                process.env.NEXT_INTERNAL_ORIGIN || "http://127.0.0.1:3000"
            );

            const r = await fetch(internalSessionUrl.toString(), {
                headers: { cookie: req.headers.get("cookie") || "" },
                cache: "no-store",
            });

            if (!r.ok) {
                const loginUrl = new URL("/login", externalOrigin);
                loginUrl.searchParams.set(
                    "returnTo",
                    pathname === "/admin" ? "/dashboard" : `${pathname}${search || ""}`
                );

                const red = loginUrl.toString();
                const res = NextResponse.redirect(red);
                return attachDebugHeaders(res, {
                    host,
                    pathname,
                    subdomain: null,
                    isProtected: true,
                    mockLogin,
                    hasMockLoginCookie: !!mockLoginCookie,
                    hasMockTenantCookie: !!mockTenantCookie,
                    action: "redirect(admin protected -> /login)",
                    redirectTo: red,
                });
            }

            const res = NextResponse.next();
            return attachDebugHeaders(res, {
                host,
                pathname,
                subdomain: null,
                isProtected: true,
                mockLogin,
                hasMockLoginCookie: !!mockLoginCookie,
                hasMockTenantCookie: !!mockTenantCookie,
                action: "next(admin protected OK)",
            });
        } catch {
            const loginUrl = new URL("/login", externalOrigin);
            loginUrl.searchParams.set(
                "returnTo",
                pathname === "/admin" ? "/dashboard" : `${pathname}${search || ""}`
            );

            const red = loginUrl.toString();
            const res = NextResponse.redirect(red);
            return attachDebugHeaders(res, {
                host,
                pathname,
                subdomain: null,
                isProtected: true,
                mockLogin,
                hasMockLoginCookie: !!mockLoginCookie,
                hasMockTenantCookie: !!mockTenantCookie,
                action: "redirect(admin protected fetch error)",
                redirectTo: red,
            });
        }
    }

    // =========================
    // tenant 서브도메인 처리
    // =========================
    const ENABLE_SUBDOMAIN_TENANT = process.env.TENANT_BY_SUBDOMAIN === "1";
    const subdomain = ENABLE_SUBDOMAIN_TENANT ? getSubdomain(host) : null;

    // main 도메인 등은 그대로
    if (!subdomain) {
        const res = NextResponse.next();
        return attachDebugHeaders(res, {
            host,
            pathname,
            subdomain: null,
            isProtected: false,
            mockLogin,
            hasMockLoginCookie: !!mockLoginCookie,
            hasMockTenantCookie: !!mockTenantCookie,
            action: "next(no-tenant)",
        });
    }

    // tenant 서브도메인에서 전역 라우트 bypass
    if (
        pathname === "/login" ||
        pathname.startsWith("/login/") ||
        pathname === "/select-tenant" ||
        pathname.startsWith("/select-tenant/")
    ) {
        const res = NextResponse.next();
        return attachDebugHeaders(res, {
            host,
            pathname,
            subdomain,
            isProtected: false,
            mockLogin,
            hasMockLoginCookie: !!mockLoginCookie,
            hasMockTenantCookie: !!mockTenantCookie,
            action: "next(tenant bypass global path)",
        });
    }

    // ✅ tenant 루트("/")는 외부 기준 "/home"으로 처리
    const externalPath = pathname === "/" ? "/home" : pathname;

    // ✅ 내부 라우트는 /{tenant}/... 로 rewrite
    const firstSeg = externalPath.split("/").filter(Boolean)[0] || "";
    const alreadyPrefixed = firstSeg === subdomain;

    const bypass =
        externalPath.startsWith("/seller/") ||
        externalPath.startsWith("/api") ||
        externalPath.startsWith("/_next") ||
        externalPath === "/favicon.ico";

    const internalPathname = !alreadyPrefixed && !bypass ? `/${subdomain}${externalPath}` : externalPath;

    if (isPublicPath(pathname)) {
        const res = NextResponse.next();
        return attachDebugHeaders(res, {
            host,
            pathname,
            subdomain,
            internalPathname,
            isProtected: false,
            mockLogin,
            hasMockLoginCookie: !!mockLoginCookie,
            hasMockTenantCookie: !!mockTenantCookie,
            action: "next(tenant public path)",
        });
    }

    const isProtected = needsAuth(internalPathname);

    // ✅ 보호 경로가 아니면 rewrite/next
    if (!isProtected) {
        if (internalPathname !== pathname) {
            const res = NextResponse.rewrite(makeInternalRewriteUrl(req, internalPathname, search));
            return attachDebugHeaders(res, {
                host,
                pathname,
                subdomain,
                internalPathname,
                isProtected,
                mockLogin,
                hasMockLoginCookie: !!mockLoginCookie,
                hasMockTenantCookie: !!mockTenantCookie,
                action: "rewrite(tenant unprotected)",
            });
        }

        const res = NextResponse.next();
        return attachDebugHeaders(res, {
            host,
            pathname,
            subdomain,
            internalPathname,
            isProtected,
            mockLogin,
            hasMockLoginCookie: !!mockLoginCookie,
            hasMockTenantCookie: !!mockTenantCookie,
            action: "next(tenant unprotected)",
        });
    }

    // ✅ 보호 경로 + 로그인 상태면 통과 (rewrite)
    if (mockLogin) {
        if (internalPathname !== pathname) {
            const res = NextResponse.rewrite(makeInternalRewriteUrl(req, internalPathname, search));
            return attachDebugHeaders(res, {
                host,
                pathname,
                subdomain,
                internalPathname,
                isProtected,
                mockLogin,
                hasMockLoginCookie: !!mockLoginCookie,
                hasMockTenantCookie: !!mockTenantCookie,
                action: "rewrite(tenant protected OK)",
            });
        }

        const res = NextResponse.next();
        return attachDebugHeaders(res, {
            host,
            pathname,
            subdomain,
            internalPathname,
            isProtected,
            mockLogin,
            hasMockLoginCookie: !!mockLoginCookie,
            hasMockTenantCookie: !!mockTenantCookie,
            action: "next(tenant protected OK)",
        });
    }

    // ✅ 보호 경로 + 미로그인 => auth로 이동
    const AUTH_ORIGIN = getEnvOrigin("AUTH");
    const loginUrl = new URL("/login", AUTH_ORIGIN);

    // returnTo는 "해당 tenant 홈" 절대 URL로 고정
    loginUrl.searchParams.set("tenant", subdomain);
    loginUrl.searchParams.set("returnTo", buildTenantHomeAbs(req, subdomain));

    const red = loginUrl.toString();
    const res = NextResponse.redirect(red);

    return attachDebugHeaders(res, {
        host,
        pathname,
        subdomain,
        internalPathname,
        isProtected,
        mockLogin,
        hasMockLoginCookie: !!mockLoginCookie,
        hasMockTenantCookie: !!mockTenantCookie,
        action: "redirect(tenant protected -> auth/login)",
        redirectTo: red,
    });
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};