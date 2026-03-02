// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

function isGlobalRoute(pathname: string) {
    return (
        pathname === "/select-tenant" ||
        pathname.startsWith("/select-tenant/") ||
        pathname === "/login" ||
        pathname.startsWith("/login/") ||
        pathname === "/admin/login" ||
        pathname.startsWith("/admin/login/")
    );
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

function isAdminPath(pathname: string) {
    return pathname === "/admin" || pathname.startsWith("/admin/");
}

function getSubdomain(host: string) {
    const h = host.split(":")[0].toLowerCase();

    if (h === "localhost") return null;
    if (h.endsWith(".localhost")) return null;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return null;

    const parts = h.split(".");
    if (parts.length < 3) return null;
    return parts[0];
}

export async function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;

    if (isPublicAsset(pathname)) return NextResponse.next();
    if (isGlobalRoute(pathname)) return NextResponse.next();

    // ✅ Admin 보호 (그대로)
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

    /**
     * ✅ 중요:
     * 지금 프로젝트는 "path 기반 tenant"(/b/home)로 동작 중.
     * 따라서 서브도메인 rewrite는 기본 OFF.
     * 운영에서 Host 기반 테넌트를 쓸 때만 TENANT_BY_SUBDOMAIN=1 로 켠다.
     */
    const ENABLE_SUBDOMAIN_TENANT = process.env.TENANT_BY_SUBDOMAIN === "1";

    if (ENABLE_SUBDOMAIN_TENANT) {
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
    }

    if (isPublicPath(pathname)) return NextResponse.next();
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
    if (!tenant) {
        loginUrl.pathname = "/select-tenant";
    } else {
        loginUrl.pathname = `/${tenant}/login`;
        loginUrl.searchParams.set("returnTo", returnToWithQuery);
    }

    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};