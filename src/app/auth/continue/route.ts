// src/app/auth/continue/route.ts
// auth 에만 보이는 세션을 목적지 호스트 /auth/claim 으로 넘겨 Domain=.zpzp.kr 쿠키를 심는다.
import { NextRequest } from "next/server";
import {
    attachSharedSessionCookie,
    extractSessionIdFromSetCookies,
    parseCookieValue,
} from "@/lib/auth/session-cookie";
import { signSessionClaim } from "@/lib/auth/session-claim";

export const runtime = "nodejs";

function getApiBase() {
    return (
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:4000"
    ).replace(/\/+$/, "");
}

function allowedReturnTo(raw: string): string | null {
    const s = String(raw || "").trim();
    if (!s) return null;

    try {
        if (/^https?:\/\//i.test(s)) {
            const u = new URL(s);
            const host = u.hostname.toLowerCase();
            const base = (process.env.TENANT_BASE_DOMAIN || "zpzp.kr").toLowerCase();
            if (host === base || host.endsWith(`.${base}`)) return u.toString();
            return null;
        }
        if (s.startsWith("/")) return s;
        return null;
    } catch {
        return null;
    }
}

function loginFallback(req: NextRequest, returnTo: string) {
    const u = new URL("/login", req.nextUrl.origin);
    if (returnTo) u.searchParams.set("returnTo", returnTo);
    const tenant = req.nextUrl.searchParams.get("tenant");
    if (tenant) u.searchParams.set("tenant", tenant);
    u.searchParams.set("syncFailed", "1");
    return u.toString();
}

function sameHost(a: string, b: string) {
    try {
        return new URL(a).host.toLowerCase() === new URL(b).host.toLowerCase();
    } catch {
        return false;
    }
}

export async function GET(req: NextRequest) {
    const returnToRaw = req.nextUrl.searchParams.get("returnTo") || "";
    const returnTo = allowedReturnTo(returnToRaw);

    if (!returnTo) {
        return Response.json({ ok: false, error: "INVALID_RETURN_TO" }, { status: 400 });
    }

    try {
        const refreshRes = await fetch(`${getApiBase()}/v1/auth/session/refresh`, {
            method: "POST",
            headers: {
                accept: "application/json",
                cookie: req.headers.get("cookie") || "",
            },
            cache: "no-store",
            redirect: "manual",
        });

        if (!refreshRes.ok) {
            const headers = new Headers();
            headers.set("Location", loginFallback(req, returnTo));
            return new Response(null, { status: 302, headers });
        }

        // 쿠키 값은 @fastify/session 서명값이어야 함 — raw sessionId 를 심으면 세션 조회 실패
        await refreshRes.json().catch(() => null);
        const sessionId =
            extractSessionIdFromSetCookies(refreshRes) ||
            parseCookieValue(req.headers.get("cookie") || "", "dad_admin_sid");

        if (!sessionId) {
            const headers = new Headers();
            headers.set("Location", loginFallback(req, returnTo));
            return new Response(null, { status: 302, headers });
        }

        const target = /^https?:\/\//i.test(returnTo)
            ? returnTo
            : new URL(returnTo, req.nextUrl.origin).toString();

        const headers = new Headers();

        // 같은 호스트면 여기서 바로 쿠키를 심고 이동
        if (sameHost(target, req.nextUrl.origin)) {
            headers.set("Location", target);
            attachSharedSessionCookie(headers, req, sessionId);
            console.log("AUTH_CONTINUE_SAME_HOST", target);
            return new Response(null, { status: 302, headers });
        }

        // 다른 서브도메인: 목적지에서 Set-Cookie (브라우저가 가장 안정적으로 받음)
        const ticket = signSessionClaim({ sid: sessionId, next: target });
        const claim = new URL("/auth/claim", target);
        claim.searchParams.set("ticket", ticket);
        claim.searchParams.set("returnTo", target);

        headers.set("Location", claim.toString());
        // auth 쪽에도 Domain 쿠키를 같이 내려 이후 auth 세션 확인이 깨지지 않게 한다
        attachSharedSessionCookie(headers, req, sessionId);

        console.log("AUTH_CONTINUE_CLAIM", claim.origin + claim.pathname);
        return new Response(null, { status: 302, headers });
    } catch (e: any) {
        console.error("AUTH_CONTINUE_FAILED", e?.message || e);
        const headers = new Headers();
        headers.set("Location", loginFallback(req, returnTo));
        return new Response(null, { status: 302, headers });
    }
}
