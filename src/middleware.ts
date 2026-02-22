// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

function isPublicPath(pathname: string) {
    // 공용/정적/인증 라우트 제외
    if (pathname.startsWith("/_next")) return true;
    if (pathname === "/favicon.ico") return true;

    // API는 통과 (단, auth API는 통과)
    if (pathname.startsWith("/api")) return true;

    return false;
}

function needsAuth(pathname: string) {
    // ✅ 고객(사이트) 영역 중 보호할 경로들
    // /{tenant}/home, /{tenant}/cart, /{tenant}/order, /{tenant}/orders 등
    const siteProtected = /^\/[^/]+\/(home|cart|order|orders)(\/|$)/;

    // ✅ 셀러 영역 보호: /seller/{tenant}/products, /seller/{tenant}/orders
    const sellerProtected = /^\/seller\/[^/]+\/(products|orders)(\/|$)/;

    return siteProtected.test(pathname) || sellerProtected.test(pathname);
}

function extractTenant(pathname: string) {
    const segs = pathname.split("/").filter(Boolean);

    // /seller/{tenant}/...
    if (segs[0] === "seller") return segs[1] || "";

    // /{tenant}/...
    return segs[0] || "";
}

export function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;

    if (isPublicPath(pathname)) {
        return NextResponse.next();
    }

    if (!needsAuth(pathname)) {
        return NextResponse.next();
    }

    const mockLogin = req.cookies.get("mockLogin")?.value === "1";
    if (mockLogin) {
        return NextResponse.next();
    }

    const tenant = extractTenant(pathname);

    // 로그인 후 돌아갈 위치
    // - site: /{tenant}/home 형태로 돌아가야 하므로 tenant 제거 후 returnTo 생성
    // - seller: /seller/{tenant}/... 그대로 returnTo로 저장해도 되지만,
    //   현재 로그인 페이지는 /{tenant}/login 한 곳이므로 returnTo는 "tenant 이후 경로"로 통일
    let returnTo = "/home";
    if (tenant) {
        const prefix1 = `/${tenant}`;
        const prefix2 = `/seller/${tenant}`;

        if (pathname.startsWith(prefix2)) {
            // seller 경로는 /seller/{tenant} 이후를 returnTo로 보관하되, /home로 기본
            const rest = pathname.slice(prefix2.length) || "/home";
            returnTo = rest.startsWith("/") ? rest : `/${rest}`;
        } else if (pathname.startsWith(prefix1)) {
            const rest = pathname.slice(prefix1.length) || "/home";
            returnTo = rest.startsWith("/") ? rest : `/${rest}`;
        }
    }

    // 쿼리까지 포함해서 복귀(필요 시)
    const returnToWithQuery = `${returnTo}${search || ""}`;

    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = tenant ? `/${tenant}/login` : `/login`;
    loginUrl.searchParams.set("returnTo", returnToWithQuery);

    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};