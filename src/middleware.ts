// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveRefCookie } from "./lib/ref-cookie";
import { getSlugResolution } from "./lib/slug-resolve";

const API_BASE_URL = (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:4000"
).replace(/\/+$/, "");

const RESERVED_SUBDOMAINS = new Set([
    "www",
    "admin",
    "auth",
    "api",
    "select-tenant",
    "seller",
    "hq", // 본사몰 컨텍스트(링커 rewrite 대상). hq.zpzp.kr 직접접속을 tenant 로 취급하지 않음. 링커→/hq 내부 rewrite 는 무영향(경로 기반).
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
    if (pathname.startsWith("/auth")) return true;
    return false;
}

function isAdminPath(pathname: string) {
    return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isSellerInternalPath(pathname: string) {
    return pathname === "/seller" || pathname.startsWith("/seller/");
}

function needsAuth(pathname: string) {
    // 노출정책 (a) — 2026-07-27 확정(docs/FOLLOWUP_MASKING_PICKUP.md F-8).
    // 스토어 홈·상품 목록·상세는 비회원 public(가격은 API가 마스킹해 회원가으로 노출).
    // 기획서 §8은 "비회원이 스토어를 보되 실판매가만 못 본다"를 전제하므로 열람 자체를 막지 않는다.
    // 로그인 게이트는 장바구니·주문·주문내역·포인트·설정(마이페이지)과 셀러 콘솔에만 둔다.
    const siteProtected = /^\/[^/]+\/(cart|order|orders|points|settings)(\/|$)/;
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
    return process.env.TENANT_BASE_DOMAIN || "zpzp.kr";
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
        return process.env.AUTH_ORIGIN || process.env.MAIN_ORIGIN || "https://auth.zpzp.kr";
    }
    if (kind === "SELECT_TENANT") {
        return process.env.SELECT_TENANT_ORIGIN || "https://select-tenant.zpzp.kr";
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

/** 지금 열려던 페이지 절대 URL — 로그인 후 여기로 복귀 */
function buildRequestAbs(req: NextRequest) {
    const { pathname, search } = req.nextUrl;
    return `${getExternalOrigin(req)}${pathname}${search || ""}`;
}

/** App Router soft-nav(RSC) — 크로스 오리진 302 하면 CORS 로 깨진다 */
function isFlightRequest(req: NextRequest) {
    if (req.headers.get("rsc") === "1") return true;
    if (req.headers.get("RSC") === "1") return true;
    if (req.headers.get("next-router-prefetch") === "1") return true;
    if (req.headers.get("Next-Router-Prefetch") === "1") return true;
    if (req.nextUrl.searchParams.has("_rsc")) return true;
    return false;
}

/**
 * 스토어: RSC 면 같은 호스트 /{tenant}/login 브릿지(클라이언트→auth).
 * 문서 네비는 auth 로 직행. returnTo 는 요청 URL 유지.
 */
function redirectStorefrontToLogin(
    req: NextRequest,
    tenant: string,
    cookieTenant: string,
    subdomain: string | null
) {
    const returnTo = buildRequestAbs(req);

    if (isFlightRequest(req) && tenant) {
        const bridge = new URL(`/${tenant}/login`, getExternalOrigin(req));
        bridge.searchParams.set("returnTo", returnTo);
        return setSelectedTenantCookie(
            NextResponse.redirect(bridge),
            req,
            cookieTenant,
            subdomain
        );
    }

    const loginUrl = new URL("/login", getEnvOrigin("AUTH"));
    loginUrl.searchParams.set("tenant", tenant);
    loginUrl.searchParams.set("returnTo", returnTo);
    loginUrl.searchParams.set("auto", "0");
    return setSelectedTenantCookie(
        NextResponse.redirect(loginUrl),
        req,
        cookieTenant,
        subdomain
    );
}

function buildSellerReturnAbs(req: NextRequest, tenant: string, pathAfterTenant = "") {
    const sellerOrigin = getEnvOrigin("SELLER");
    const normalized = pathAfterTenant.startsWith("/") ? pathAfterTenant : `/${pathAfterTenant}`;
    return `${sellerOrigin}/${tenant}${pathAfterTenant ? normalized : ""}`;
}

function redirectSellerToLogin(req: NextRequest, tenant: string, returnTo: string) {
    const loginUrl = new URL("/login", getEnvOrigin("AUTH"));
    if (tenant) loginUrl.searchParams.set("tenant", tenant);
    loginUrl.searchParams.set("returnTo", returnTo);
    loginUrl.searchParams.set("auto", "0");
    return setSelectedTenantCookie(NextResponse.redirect(loginUrl), req, tenant);
}

function getTenantCookieOptions(req: NextRequest) {
    const host = getHost(req);
    const localLike = isLikelyLocalHost(host);
    const proto =
        (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim() ||
        req.nextUrl.protocol.replace(":", "") ||
        "http";

    const secure = !localLike && proto === "https";
    const sameSite: "lax" | "none" = secure ? "none" : "lax";

    const base = {
        path: "/",
        httpOnly: true,
        sameSite,
        secure,
        maxAge: 60 * 60 * 24 * 7,
    } as const;

    if (localLike) {
        return base;
    }

    return {
        ...base,
        domain: process.env.COOKIE_DOMAIN || ".zpzp.kr",
    } as const;
}

function getRefCookieOptions(req: NextRequest) {
    return {
        path: "/",
        httpOnly: true,
        sameSite: "lax" as const,
        domain: process.env.COOKIE_DOMAIN || ".zpzp.kr",
        maxAge: 60 * 60 * 24 * 90, // 90일 (spec R3.1)
    };
}

/** zpzp_ref 신규 스탬프 시 API에 visit 이벤트 기록(실패 무시) */
function reportLinkerVisit(req: NextRequest, slug: string) {
    if (isOgCrawler(req)) return;
    const apiBase =
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:4000";
    const url = `${apiBase.replace(/\/+$/, "")}/v1/public/linker/visit`;
    return fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            accept: "application/json",
        },
        body: JSON.stringify({ slug }),
        cache: "no-store",
    }).catch(() => undefined);
}

function setSelectedTenantCookie(
    res: NextResponse,
    req: NextRequest,
    tenant: string | null | undefined,
    refSlug?: string
) {
    const value = String(tenant || "").trim().toLowerCase();
    if (!value) return res;

    res.cookies.set("selectedTenant", value, getTenantCookieOptions(req));

    // refSlug(원래 방문 서브도메인/링커 slug)가 명시되면 그 값으로 zpzp_ref를 스탬프한다
    // (selectedTenant=점포 slug와 달라질 수 있는 링커 방문 케이스). 없으면 기존처럼
    // 현재 호스트의 서브도메인이 tenant 값과 일치할 때만 스탬프.
    const sub = refSlug ?? getSubdomain(getHost(req));
    const shouldStampRef = !!refSlug || sub?.toLowerCase() === value;
    if (sub && shouldStampRef) {
        const refValue = resolveRefCookie(req.cookies.get("zpzp_ref")?.value, sub);
        if (refValue) {
            res.cookies.set("zpzp_ref", refValue, getRefCookieOptions(req));
            // 링커 첫 유입 로그 — 본 요청을 막지 않도록 fire-and-forget
            void reportLinkerVisit(req, refValue);
        }
    }

    res.headers.set("X-Dad-Debug-SelectedTenant", value);
    return res;
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

function isOgCrawler(req: NextRequest): boolean {
    const ua = (req.headers.get("user-agent") || "").toLowerCase();
    return (
        ua.includes("kakaotalk") ||
        ua.includes("kakao") ||
        ua.includes("facebookexternalhit") ||
        ua.includes("twitterbot") ||
        ua.includes("linkedinbot") ||
        ua.includes("slackbot") ||
        ua.includes("telegrambot") ||
        ua.includes("whatsapp") ||
        ua.includes("discordbot") ||
        ua.includes("applebot") ||
        ua.includes("googlebot")
    );
}

async function hasUserSession(req: NextRequest) {
    const apiBase =
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:4000";

    try {
        const res = await fetch(`${apiBase.replace(/\/+$/, "")}/v1/auth/session`, {
            headers: {
                accept: "application/json",
                cookie: req.headers.get("cookie") || "",
            },
            cache: "no-store",
        });

        if (!res.ok) return false;

        const data = await res.json().catch(() => null);
        return !!data?.loggedIn;
    } catch {
        return false;
    }
}

export async function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;

    if (isPublicAsset(pathname)) return NextResponse.next();

    const host = getHost(req);
    const externalOrigin = getExternalOrigin(req);

    const LOCAL_BYPASS_AUTH = process.env.LOCAL_BYPASS_AUTH === "1";
    const localLike = isLikelyLocalHost(host);
    const bypassAuth = LOCAL_BYPASS_AUTH && localLike;

    if (isAuthHost(host)) {
        return NextResponse.next();
    }

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

    if (isSellerHost(host)) {
        if (isPublicPath(pathname)) return NextResponse.next();

        if (pathname === "/seller" || pathname.startsWith("/seller/")) {
            return NextResponse.next();
        }

        // ✅ seller 루트에서는 기존 selectedTenant 쿠키가 있으면 해당 tenant로 바로 연결
        if (pathname === "/" || pathname === "") {
            const selectedTenant = (req.cookies.get("selectedTenant")?.value || "").trim().toLowerCase();

            if (selectedTenant) {

                const redirectUrl = new URL(req.url);
                redirectUrl.pathname = `/${selectedTenant}`;

                return setSelectedTenantCookie(
                    NextResponse.redirect(redirectUrl),
                    req,
                    selectedTenant
                );
                // return setSelectedTenantCookie(
                //     NextResponse.rewrite(
                //         makeInternalRewriteUrl(req, `/seller/${selectedTenant}`, search)
                //     ),
                //     req,
                //     selectedTenant
                // );
            }

            return NextResponse.rewrite(makeInternalRewriteUrl(req, "/seller", search));
        }

        const segs = pathname.split("/").filter(Boolean);
        const firstSeg = segs[0] || "";

        if (
            !firstSeg ||
            firstSeg === "select-tenant" ||
            firstSeg === "admin" ||
            firstSeg === "auth" ||
            firstSeg === "api"
        ) {
            return NextResponse.rewrite(makeInternalRewriteUrl(req, "/seller", search));
        }

        const tenant = firstSeg;
        const rest = segs.slice(1).join("/");
        const internalPath = rest ? `/seller/${tenant}/${rest}` : `/seller/${tenant}`;

        const mockLoginCookie = req.cookies.get("mockLogin")?.value === "1";
        const mockLogin = false;
        const hasSession = bypassAuth ? true : await hasUserSession(req);
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
            res.headers.set("X-Dad-Debug-HasSession", String(hasSession));
            return res;
        };

        if (!isProtected || mockLogin || hasSession) {
            return addDebug(
                setSelectedTenantCookie(
                    NextResponse.rewrite(makeInternalRewriteUrl(req, internalPath, search)),
                    req,
                    tenant
                ),
                !isProtected ? "seller-rewrite(unprotected)" : "seller-rewrite(protected OK)"
            );
        }

        return addDebug(
            redirectSellerToLogin(
                req,
                tenant,
                buildSellerReturnAbs(req, tenant, rest ? `/${rest}` : "")
            ),
            "seller-redirect(auth)"
        );
    }

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

    if (isSellerInternalPath(pathname)) {
        if (isPublicPath(pathname)) return NextResponse.next();

        const mockLoginCookie = req.cookies.get("mockLogin")?.value === "1";
        const mockLogin = false;
        const hasSession = bypassAuth ? true : await hasUserSession(req);

        if (!needsAuth(pathname) || mockLogin || hasSession) {
            const segs = pathname.split("/").filter(Boolean);
            const tenant = segs[1] || "";
            return setSelectedTenantCookie(NextResponse.next(), req, tenant);
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
            loginUrl.searchParams.set("auto", "0");
        }

        return setSelectedTenantCookie(NextResponse.redirect(loginUrl), req, tenant);
    }

    const ENABLE_SUBDOMAIN_TENANT = process.env.TENANT_BY_SUBDOMAIN === "1";
    const subdomain = ENABLE_SUBDOMAIN_TENANT ? getSubdomain(host) : null;

    if (!subdomain) return NextResponse.next();

    const resolution = await getSlugResolution(subdomain, API_BASE_URL, Date.now());
    if (resolution.kind === "none") {
        return NextResponse.redirect(getEnvOrigin("SITE")); // 미등록 slug → 본사
    }
    const effectiveTenant = resolution.tenantSlug || subdomain;

    if (
        pathname === "/login" ||
        pathname.startsWith("/login/") ||
        pathname === "/select-tenant" ||
        pathname.startsWith("/select-tenant/")
    ) {
        return setSelectedTenantCookie(NextResponse.next(), req, effectiveTenant, subdomain);
    }

    const externalPath = pathname === "/" ? "/home" : pathname;

    const firstSeg = externalPath.split("/").filter(Boolean)[0] || "";
    const alreadyPrefixed = firstSeg === effectiveTenant;

    const bypass =
        externalPath.startsWith("/seller/") ||
        externalPath.startsWith("/api") ||
        externalPath.startsWith("/auth") ||
        externalPath.startsWith("/_next") ||
        externalPath.startsWith("/uploads") ||
        externalPath.startsWith("/images") ||
        externalPath === "/favicon.ico";

    const internalPathname =
        !alreadyPrefixed && !bypass ? `/${effectiveTenant}${externalPath}` : externalPath;

    if (isPublicPath(pathname)) return setSelectedTenantCookie(NextResponse.next(), req, effectiveTenant, subdomain);

    const mockLoginCookie = req.cookies.get("mockLogin")?.value === "1";
    const mockLogin = false;
    const crawler = isOgCrawler(req);
    const hasSession = bypassAuth ? true : await hasUserSession(req);
    const isProtected = needsAuth(internalPathname);

    const addDebug = (res: NextResponse, action: string) => {
        res.headers.set("X-Dad-Debug-Action", action);
        res.headers.set("X-Dad-Debug-Host", host);
        res.headers.set("X-Dad-Debug-Sub", subdomain ?? "");
        res.headers.set("X-Dad-Debug-Path", pathname);
        res.headers.set("X-Dad-Debug-Internal", internalPathname);
        res.headers.set("X-Dad-Debug-Protected", String(isProtected));
        res.headers.set("X-Dad-Debug-Has-Mocklogin", String(!!req.cookies.get("mockLogin")?.value));
        res.headers.set("X-Dad-Debug-Mocklogin", String(mockLogin));
        res.headers.set("X-Dad-Debug-BypassAuth", String(bypassAuth));
        res.headers.set("X-Dad-Debug-HasSession", String(hasSession));
        return res;
    };

    if (!isProtected || mockLogin || hasSession || crawler) {
        if (internalPathname !== pathname) {
            return addDebug(
                setSelectedTenantCookie(
                    NextResponse.rewrite(makeInternalRewriteUrl(req, internalPathname, search)),
                    req,
                    effectiveTenant,
                    subdomain
                ),
                crawler ? "rewrite(crawler)" : !isProtected ? "rewrite(unprotected)" : "rewrite(protected OK)"
            );
        }
        return addDebug(
            setSelectedTenantCookie(NextResponse.next(), req, effectiveTenant, subdomain),
            crawler ? "next(crawler)" : !isProtected ? "next(unprotected)" : "next(protected OK)"
        );
    }

    // tenant: 카탈로그(effectiveTenant). returnTo: 막으려던 페이지 절대 URL.
    // RSC soft-nav 는 같은 호스트 /{tenant}/login 브릿지로 보내 CORS 를 피한다.
    return addDebug(
        redirectStorefrontToLogin(req, effectiveTenant, effectiveTenant, subdomain),
        "redirect(tenant protected -> auth/login)"
    );
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};