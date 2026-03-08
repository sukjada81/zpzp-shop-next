// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

const RESERVED_SUBDOMAINS = new Set([
    "www",
    "admin",
    "auth",
    "api",
    "select-tenant",
    "seller",
]);

function isPublicAsset(pathname: string) {
    return (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/images") ||
        pathname.startsWith("/uploads") ||
        pathname.startsWith("/assets") ||
        pathname === "/favicon.ico" ||
        pathname === "/robots.txt" ||
        pathname === "/sitemap.xml" ||
        pathname === "/manifest.json" ||
        pathname === "/site.webmanifest" ||
        /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff|woff2|ttf|eot)$/i.test(pathname)
    );
}

function isPublicPath(pathname: string) {
    if (isPublicAsset(pathname)) return true;
    if (pathname.startsWith("/api")) return true;
    return false;
}

function isAdminPath(pathname: string) {
    return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isSellerInternalPath(pathname: string) {
    return pathname === "/seller" || pathname.startsWith("/seller/");
}

/**
 * 보호 경로
 * - tenant 서브도메인 "/" -> "/home" 성격으로 보호
 * - seller "/seller/[tenant]" 루트도 보호
 */
function needsAuth(pathname: string) {
    if (pathname === "/" || pathname === "/home") return true;

    const siteProtected = /^\/[^/]+\/(home|cart|order|orders|goods|points|settings)(\/|$)/;
    const sellerProtected = /^\/seller\/[^/]+(\/|$)/;

    return siteProtected.test(pathname) || sellerProtected.test(pathname);
}

function getHost(req: NextRequest) {
    return (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
        .split(",")[0]
        .trim()
        .toLowerCase();
}

function makeInternalRewriteUrl(req: NextRequest, pathname: string, search: string) {
    const internalOrigin = process.env.NEXT_INTERNAL_ORIGIN || "http://127.0.0.1:3000";
    const url = new URL(pathname, internalOrigin);
    url.search = search || "";
    return url;
}

function getExternalOrigin(req: NextRequest) {
    const proto =
        (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim() || "http";
    const host =
        (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
            .split(",")[0]
            .trim();

    if (!host) return req.nextUrl.origin;
    return `${proto}://${host}`;
}

function getHostOnly(host: string) {
    return (host || "").split(":")[0].toLowerCase();
}

function isLikelyLocalHost(host: string) {
    const h = (host || "").split(",")[0].trim().toLowerCase();
    const hostOnly = getHostOnly(h);

    if (!hostOnly) return true;
    if (hostOnly === "localhost") return true;
    if (hostOnly.endsWith(".localhost")) return true;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly)) return true;
    if (h.includes(":3000") || h.includes(":5173") || h.includes(":8080")) return true;

    return false;
}

function getBaseDomain() {
    return process.env.TENANT_BASE_DOMAIN || "discountallday.kr";
}

function getSubdomain(host: string) {
    const hostOnly = getHostOnly(host);
    if (!hostOnly) return null;

    if (hostOnly === "localhost") return null;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly)) return null;

    const parts = hostOnly.split(".");
    if (parts.length < 3) return null;

    const sub = parts[0];
    if (!sub || RESERVED_SUBDOMAINS.has(sub)) return null;

    return sub;
}

function isSellerHost(host: string) {
    const hostOnly = getHostOnly(host);
    const baseDomain = getBaseDomain();
    return hostOnly === `seller.${baseDomain}`;
}

function isAdminHost(host: string) {
    const hostOnly = getHostOnly(host);
    const baseDomain = getBaseDomain();
    return hostOnly === `admin.${baseDomain}`;
}

function isAuthHost(host: string) {
    const hostOnly = getHostOnly(host);
    const baseDomain = getBaseDomain();
    return hostOnly === `auth.${baseDomain}`;
}

function isSelectTenantHost(host: string) {
    const hostOnly = getHostOnly(host);
    const baseDomain = getBaseDomain();
    return hostOnly === `select-tenant.${baseDomain}`;
}

function getEnvOrigin(kind: "AUTH" | "SITE" | "SELECT_TENANT" | "SELLER") {
    if (kind === "AUTH") {
        return process.env.AUTH_ORIGIN || process.env.MAIN_ORIGIN || "https://auth.discountallday.kr";
    }
    if (kind === "SELECT_TENANT") {
        return process.env.SELECT_TENANT_ORIGIN || "https://select-tenant.discountallday.kr";
    }
    if (kind === "SELLER") {
        return process.env.SELLER_ORIGIN || `https://seller.${getBaseDomain()}`;
    }
    return process.env.SITE_ORIGIN || `https://${getBaseDomain()}`;
}

function buildTenantHomeAbs(req: NextRequest, tenant: string) {
    const baseDomain = getBaseDomain();

    const host =
        (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
            .split(",")[0]
            .trim();
    const proto =
        (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim() || "http";

    const portMatch = host.match(/:(\d+)$/);
    const port = portMatch ? portMatch[1] : "";
    const portPart = proto === "http" && port ? `:${port}` : "";

    const httpsPreferred =
        !isLikelyLocalHost(host) && (process.env.AUTH_ORIGIN || "").startsWith("https://");
    const finalProto = httpsPreferred ? "https" : proto;

    return `${finalProto}://${tenant}.${baseDomain}${portPart}/home`;
}

function buildSellerReturnAbs(req: NextRequest, tenant: string, pathAfterTenant = "") {
    const sellerOrigin = getEnvOrigin("SELLER");
    const normalized = pathAfterTenant.startsWith("/") ? pathAfterTenant : `/${pathAfterTenant}`;
    return `${sellerOrigin}/${tenant}${pathAfterTenant ? normalized : ""}`;
}

function resolveSellerTenant(req: NextRequest) {
    const fromSellerCookie = req.cookies.get("sellerTenant")?.value?.trim();
    if (fromSellerCookie) return fromSellerCookie;

    const fromMockTenant = req.cookies.get("mockTenant")?.value?.trim();
    if (fromMockTenant) return fromMockTenant;

    const fromEnv = (process.env.DEFAULT_SELLER_TENANT || "").trim();
    if (fromEnv) return fromEnv;

    return "";
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

    const LOCAL_BYPASS_AUTH = process.env.LOCAL_BYPASS_AUTH === "1";
    const localLike = isLikelyLocalHost(host);
    const bypassAuth = LOCAL_BYPASS_AUTH && localLike;

    // auth host는 그대로
    if (isAuthHost(host)) {
        return NextResponse.next();
    }

    // select-tenant host
    if (isSelectTenantHost(host)) {
        if (isPublicPath(pathname)) return NextResponse.next();

        if (pathname === "/") {
            return NextResponse.rewrite(makeInternalRewriteUrl(req, "/select-tenant", search));
        }

        if (pathname === "/select-tenant" || pathname.startsWith("/select-tenant/")) {
            return NextResponse.next();
        }

        return NextResponse.redirect(new URL("/", externalOrigin));
    }

    // admin host
    if (isAdminHost(host)) {
        if (isPublicPath(pathname)) return NextResponse.next();

        if (pathname === "/login" || pathname.startsWith("/login/")) {
            return NextResponse.rewrite(makeInternalRewriteUrl(req, `/admin${pathname}`, search));
        }

        if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
            return NextResponse.next();
        }

        if (!bypassAuth) {
            try {
                const ok = await hasAdminSession(req);
                if (!ok) {
                    const loginUrl = new URL("/login", externalOrigin);
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

        if (pathname === "/" || pathname === "/dashboard") {
            return NextResponse.rewrite(makeInternalRewriteUrl(req, "/admin/dashboard", search));
        }

        if (pathname === "/admin" || pathname.startsWith("/admin/")) {
            if (pathname === "/admin") {
                return NextResponse.rewrite(makeInternalRewriteUrl(req, "/admin/dashboard", search));
            }
            return NextResponse.next();
        }

        return NextResponse.rewrite(makeInternalRewriteUrl(req, `/admin${pathname}`, search));
    }

    // seller host: seller.discountallday.kr/{tenant}/...
    if (isSellerHost(host)) {
        if (isPublicPath(pathname)) return NextResponse.next();

        // ✅ seller 루트는 자동 이동하지 않고 seller root page 로 보냄
        if (pathname === "/" || pathname === "") {
            return NextResponse.rewrite(makeInternalRewriteUrl(req, "/seller", search));
        }

        const segs = pathname.split("/").filter(Boolean);
        const firstSeg = segs[0] || "";

        // ✅ 예약어는 tenant로 취급하지 않음
        if (
            !firstSeg ||
            firstSeg === "select-tenant" ||
            firstSeg === "admin" ||
            firstSeg === "auth" ||
            firstSeg === "seller" ||
            firstSeg === "api"
        ) {
            return NextResponse.rewrite(makeInternalRewriteUrl(req, "/seller", search));
        }

        const tenant = firstSeg;
        const rest = segs.slice(1).join("/");
        const internalPath = rest ? `/seller/${tenant}/${rest}` : `/seller/${tenant}`;

        const mockLoginCookie = req.cookies.get("mockLogin")?.value === "1";
        const mockLogin = bypassAuth ? true : mockLoginCookie;
        const isProtected = needsAuth(internalPath);

        const addDebug = (res: NextResponse, action: string) => {
            res.headers.set("X-Dad-Debug-Action", action);
            res.headers.set("X-Dad-Debug-Host", host);
            res.headers.set("X-Dad-Debug-SellerTenant", tenant);
            res.headers.set("X-Dad-Debug-Path", pathname);
            res.headers.set("X-Dad-Debug-Internal", internalPath);
            res.headers.set("X-Dad-Debug-Protected", String(isProtected));
            res.headers.set("X-Dad-Debug-Mocklogin", String(mockLogin));
            res.headers.set("X-Dad-Debug-BypassAuth", String(bypassAuth));
            return res;
        };

        if (!isProtected || mockLogin) {
            return addDebug(
                NextResponse.rewrite(makeInternalRewriteUrl(req, internalPath, search)),
                !isProtected ? "seller-rewrite(unprotected)" : "seller-rewrite(protected OK)"
            );
        }

        const authOrigin = getEnvOrigin("AUTH");
        const loginUrl = new URL("/login", authOrigin);
        loginUrl.searchParams.set("tenant", tenant);
        loginUrl.searchParams.set(
            "returnTo",
            buildSellerReturnAbs(req, tenant, rest ? `/${rest}` : "")
        );

        return addDebug(
            NextResponse.redirect(loginUrl),
            "seller-redirect(auth)"
        );
    }

    // 메인도메인 /admin 직접 접근 보호
    if (isAdminPath(pathname)) {
        if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
            return NextResponse.next();
        }

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

    // 내부 /seller 직접 접근도 허용
    if (isSellerInternalPath(pathname)) {
        if (isPublicPath(pathname)) return NextResponse.next();

        const mockLoginCookie = req.cookies.get("mockLogin")?.value === "1";
        const mockLogin = bypassAuth ? true : mockLoginCookie;

        if (!needsAuth(pathname) || mockLogin) {
            return NextResponse.next();
        }

        const segs = pathname.split("/").filter(Boolean);
        const tenant = segs[1] || "";
        const rest = segs.slice(2).join("/");

        const authOrigin = getEnvOrigin("AUTH");
        const loginUrl = new URL("/login", authOrigin);
        if (tenant) {
            loginUrl.searchParams.set("tenant", tenant);
            loginUrl.searchParams.set(
                "returnTo",
                buildSellerReturnAbs(req, tenant, rest ? `/${rest}` : "")
            );
        }

        return NextResponse.redirect(loginUrl);
    }

    // tenant subdomain 처리
    const ENABLE_SUBDOMAIN_TENANT = process.env.TENANT_BY_SUBDOMAIN === "1";
    const subdomain = ENABLE_SUBDOMAIN_TENANT ? getSubdomain(host) : null;

    if (!subdomain) return NextResponse.next();

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
        externalPath.startsWith("/uploads") ||
        externalPath.startsWith("/images") ||
        externalPath === "/favicon.ico";

    const internalPathname =
        !alreadyPrefixed && !bypass ? `/${subdomain}${externalPath}` : externalPath;

    if (isPublicPath(pathname)) return NextResponse.next();

    const mockLoginCookie = req.cookies.get("mockLogin")?.value === "1";
    const mockLogin = bypassAuth ? true : mockLoginCookie;
    const isProtected = needsAuth(internalPathname);

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

    if (!isProtected) {
        if (internalPathname !== pathname) {
            return addDebug(
                NextResponse.rewrite(makeInternalRewriteUrl(req, internalPathname, search)),
                "rewrite(unprotected)"
            );
        }
        return addDebug(NextResponse.next(), "next(unprotected)");
    }

    if (mockLogin) {
        if (internalPathname !== pathname) {
            return addDebug(
                NextResponse.rewrite(makeInternalRewriteUrl(req, internalPathname, search)),
                "rewrite(protected OK)"
            );
        }
        return addDebug(NextResponse.next(), "next(protected OK)");
    }

    const authOrigin = getEnvOrigin("AUTH");
    const loginUrl = new URL("/login", authOrigin);
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