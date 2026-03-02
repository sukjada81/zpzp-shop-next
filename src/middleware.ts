// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

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

function isAdminPath(pathname: string) {
    return pathname === "/admin" || pathname.startsWith("/admin/");
}

function needsAuth(pathname: string) {
    const siteProtected = /^\/[^/]+\/(home|cart|order|orders|goods|points|settings)(\/|$)/;
    const sellerProtected = /^\/seller\/[^/]+\/(products|orders)(\/|$)/;
    return siteProtected.test(pathname) || sellerProtected.test(pathname);
}

function extractTenantFromPath(pathname: string) {
    const segs = pathname.split("/").filter(Boolean);
    if (segs[0] === "seller") return segs[1] || "";
    return segs[0] || "";
}

function getSubdomain(host: string) {
    const h = host.split(":")[0].toLowerCase();

    if (!h) return null;

    // allow seller01.localhost for local dev (선택)
    if (h.endsWith(".localhost")) {
        const sub = h.split(".")[0];
        if (["www", "admin", "auth", "api"].includes(sub)) return null;
        return sub;
    }

    // ignore localhost / ip
    if (h === "localhost") return null;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return null;

    const parts = h.split(".");
    if (parts.length < 3) return null;

    const sub = parts[0];
    if (["www", "admin", "auth", "api"].includes(sub)) return null;

    return sub;
}

export async function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;

    // 0) static/public asset
    if (isPublicAsset(pathname)) return NextResponse.next();

    // 1) Admin 보호 (그대로 유지)
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
     * ✅ 서브도메인 테넌트 모드:
     * - 외부 URL: /home, /goods, /orders ... (tenant prefix 없음)
     * - 내부 라우트: 기존 /{tenant}/home ... 재사용
     * - middleware에서 /{tenant} prefix를 rewrite로 붙여준다.
     */
    const ENABLE_SUBDOMAIN_TENANT = process.env.TENANT_BY_SUBDOMAIN === "1";
    const host = req.headers.get("host") ?? "";
    const subdomain = ENABLE_SUBDOMAIN_TENANT ? getSubdomain(host) : null;

    // ✅ 핵심: /login 은 전역 라우트로 사용하므로 서브도메인 모드에서도 rewrite 금지
    // (지금 404의 직접 원인: /login → /seller01/login 으로 rewrite됨)
    if (subdomain) {
        if (
            pathname === "/login" ||
            pathname.startsWith("/login/") ||
            pathname === "/select-tenant" ||
            pathname.startsWith("/select-tenant/")
        ) {
            return NextResponse.next();
        }
    }

    // 2) 먼저 “서브도메인 → 내부 경로” 매핑을 계산(인증 판단도 이 기준으로)
    let internalPathname = pathname;

    if (subdomain) {
        const externalPath = pathname === "/" ? "/home" : pathname;

        const firstSeg = externalPath.split("/").filter(Boolean)[0] || "";
        const alreadyPrefixed = firstSeg === subdomain;

        const bypass =
            externalPath.startsWith("/seller/") ||
            externalPath.startsWith("/api") ||
            externalPath.startsWith("/_next") ||
            externalPath === "/favicon.ico" ||
            externalPath === "/login" ||
            externalPath.startsWith("/login/") ||
            externalPath === "/select-tenant" ||
            externalPath.startsWith("/select-tenant/");

        if (!alreadyPrefixed && !bypass) {
            internalPathname = `/${subdomain}${externalPath}`;
        } else {
            internalPathname = externalPath;
        }
    }

    // 3) public path면 통과 (API는 여기서 빠짐)
    if (isPublicPath(pathname)) {
        return NextResponse.next();
    }

    // 4) 보호 경로가 아니면, 서브도메인 모드일 때만 rewrite 적용
    const isProtected = needsAuth(internalPathname);
    if (!isProtected) {
        if (subdomain && internalPathname !== pathname) {
            const url = req.nextUrl.clone();
            url.pathname = internalPathname;
            url.search = search;
            return NextResponse.rewrite(url);
        }
        return NextResponse.next();
    }

    // 5) 인증 체크
    const mockLogin = req.cookies.get("mockLogin")?.value === "1";
    if (mockLogin) {
        if (subdomain && internalPathname !== pathname) {
            const url = req.nextUrl.clone();
            url.pathname = internalPathname;
            url.search = search;
            return NextResponse.rewrite(url);
        }
        return NextResponse.next();
    }

    // tenant 결정 (서브도메인이면 subdomain, 아니면 path에서)
    const tenant = subdomain || extractTenantFromPath(internalPathname);

    // returnTo는 외부 경로 기준이 UX 좋음 (/home)
    const externalReturnTo = (pathname === "/" ? "/home" : pathname) + (search || "");

    // ✅ 핵심: 로그인은 전역 /login 으로 보낸다 (/{tenant}/login 금지)
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("returnTo", externalReturnTo);

    // tenant가 꼭 필요하면 쿼리에 넣어도 되지만(디버그용),
    // 서브도메인 방식에선 Host로 알 수 있으므로 필수는 아님
    if (tenant) loginUrl.searchParams.set("tenant", tenant);

    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};