// src/app/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getApiBase() {
    return (
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:4000"
    ).replace(/\/+$/, "");
}

function getHeaderFirst(req: NextRequest, key: string) {
    return (req.headers.get(key) || "").split(",")[0].trim();
}

function getForwardedProto(req: NextRequest) {
    return getHeaderFirst(req, "x-forwarded-proto").toLowerCase();
}

function getForwardedHost(req: NextRequest) {
    return getHeaderFirst(req, "x-forwarded-host") || getHeaderFirst(req, "host");
}

function isDevHttp(req: NextRequest) {
    const host = (getForwardedHost(req) || "").toLowerCase();
    const proto = getForwardedProto(req) || req.nextUrl.protocol.replace(":", "");
    return proto === "http" || host.includes(":3000");
}

function isLikelyLocalHost(host: string) {
    const h = (host || "").split(",")[0].trim().toLowerCase();
    const hostOnly = h.split(":")[0];
    if (!hostOnly) return true;
    if (hostOnly === "localhost") return true;
    if (hostOnly.endsWith(".localhost")) return true;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly)) return true;
    return false;
}

function cookieDomainForShare(req: NextRequest) {
    const host = (getForwardedHost(req) || "").split(",")[0].trim();
    if (isLikelyLocalHost(host)) return undefined;
    return process.env.COOKIE_DOMAIN || ".zpzp.kr";
}

function parseSessionCookieName(rawSetCookie: string | null) {
    if (!rawSetCookie) return null;

    const firstCookie = rawSetCookie.split(/,(?=\s*[^;=]+=[^;]+)/g)[0] || "";
    const firstPart = firstCookie.split(";")[0] || "";
    const eqIndex = firstPart.indexOf("=");

    if (eqIndex < 0) return null;

    const name = firstPart.slice(0, eqIndex).trim();
    return name || null;
}

function clearCookie(
    res: NextResponse,
    name: string,
    req: NextRequest,
    options?: { httpOnly?: boolean }
) {
    const dev = isDevHttp(req);
    const secure = dev ? false : true;
    const sameSite = secure ? ("none" as const) : ("lax" as const);
    const domain = cookieDomainForShare(req);

    res.cookies.set(name, "", {
        httpOnly: options?.httpOnly ?? true,
        path: "/",
        sameSite,
        secure,
        domain,
        maxAge: 0,
    });
}

/**
 * 로그아웃 후 재로그인했을 때 돌아갈 절대 URL.
 * 1순위 Referer(로그아웃을 누른 스토어), 2순위 returnTo 파라미터(절대 URL일 때만),
 * 마지막으로 점포 선택. zpzp.kr 계열 호스트만 허용해 오픈 리다이렉트를 막는다.
 */
function resolveLogoutReturnTo(req: NextRequest) {
    const baseDomain = (process.env.TENANT_BASE_DOMAIN || "zpzp.kr").toLowerCase();
    const fallback = process.env.SELECT_TENANT_ORIGIN || "https://select-tenant.zpzp.kr";

    const candidates = [
        req.nextUrl.searchParams.get("returnTo") || "",
        req.headers.get("referer") || "",
    ];

    for (const raw of candidates) {
        if (!/^https?:\/\//i.test(raw)) continue;

        try {
            const u = new URL(raw);
            const host = u.hostname.toLowerCase();

            // 같은 서비스 도메인만. auth 자신으로 돌아가면 루프가 되므로 제외.
            if (host !== baseDomain && !host.endsWith(`.${baseDomain}`)) continue;
            if (host === `auth.${baseDomain}`) continue;

            return u.toString();
        } catch {
            continue;
        }
    }

    return fallback;
}

async function handleLogout(req: NextRequest) {
    // DAD 잔재였던 하드코딩 기본값 "a" 제거(존재하지 않는 점포).
    const tenant = req.nextUrl.searchParams.get("tenant") || "";
    const authOrigin =
        process.env.NEXT_PUBLIC_AUTH_ORIGIN ||
        process.env.AUTH_ORIGIN ||
        `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    // 재로그인 후 돌아갈 곳을 절대 URL 로 만든다.
    // 상대경로("/home")를 넘기면 카카오 콜백이 <tenant>.zpzp.kr 을 조립하는데,
    // 링커 스토어의 tenant 는 hq 라서 https://hq.zpzp.kr/home = 404 가 됐다.
    // 로그아웃을 누른 그 스토어(Referer)로 정확히 되돌리는 게 맞다.
    const backTo = resolveLogoutReturnTo(req);

    const loginUrl = new URL("/login", authOrigin);
    if (tenant) loginUrl.searchParams.set("tenant", tenant);
    loginUrl.searchParams.set("returnTo", backTo);
    loginUrl.searchParams.set("loggedOut", "1");

    const returnTo = loginUrl.toString();

    const backendRes = await fetch(`${getApiBase()}/v1/auth/logout`, {
        method: "POST",
        headers: {
            accept: "application/json",
            cookie: req.headers.get("cookie") || "",
            ...(req.headers.get("x-forwarded-host")
                ? { "x-forwarded-host": req.headers.get("x-forwarded-host") as string }
                : {}),
            ...(req.headers.get("x-forwarded-proto")
                ? { "x-forwarded-proto": req.headers.get("x-forwarded-proto") as string }
                : {}),
        },
        cache: "no-store",
        redirect: "manual",
    });

    const sessionCookieName =
        parseSessionCookieName(backendRes.headers.get("set-cookie")) || "dad_admin_sid";

    if (req.method === "GET") {
        const res = NextResponse.redirect(returnTo, { status: 302 });

        clearCookie(res, sessionCookieName, req, { httpOnly: true });
        clearCookie(res, "selectedTenant", req, { httpOnly: true });

        return res;
    }

    const payload = await backendRes.json().catch(() => ({ ok: backendRes.ok }));

    const res = NextResponse.json(payload, {
        status: backendRes.status,
    });

    clearCookie(res, sessionCookieName, req, { httpOnly: true });
    clearCookie(res, "selectedTenant", req, { httpOnly: true });

    return res;
}

export async function GET(req: NextRequest) {
    return handleLogout(req);
}

export async function POST(req: NextRequest) {
    return handleLogout(req);
}