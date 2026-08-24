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
 * 로그아웃 후 돌아갈 스토어 홈 절대 URL.
 * 1순위 returnTo 파라미터, 2순위 Referer(로그아웃을 누른 스토어),
 * 마지막으로 점포 선택. zpzp.kr 계열만 허용. 항상 /home 으로 정규화.
 * (로그인 화면으로 보내면 안 된다 — 비회원 홈·회원가 마스킹이 맞다)
 */
function resolveLogoutHome(req: NextRequest) {
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

            // 같은 서비스 도메인만. auth/seller/select-tenant 로 돌아가면 스토어 홈이 아니다.
            if (host !== baseDomain && !host.endsWith(`.${baseDomain}`)) continue;
            if (
                host === `auth.${baseDomain}` ||
                host === `seller.${baseDomain}` ||
                host === `select-tenant.${baseDomain}` ||
                host === `admin.${baseDomain}` ||
                host === `api.${baseDomain}`
            ) {
                continue;
            }

            u.pathname = "/home";
            u.search = "";
            u.hash = "";
            return u.toString();
        } catch {
            continue;
        }
    }

    return fallback;
}

async function handleLogout(req: NextRequest) {
    // DAD 잔재였던 하드코딩 기본값 "a" 제거(존재하지 않는 점포).
    // tenant 쿼리는 클라이언트가 넘기지만, 스토어 홈 복귀에는 returnTo/Referer 호스트를 쓴다.
    void (req.nextUrl.searchParams.get("tenant") || "");

    const backTo = resolveLogoutHome(req);

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
        // 스토어 홈으로 — 카카오 로그인(/login)으로 보내지 않는다.
        const res = NextResponse.redirect(backTo, { status: 302 });

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