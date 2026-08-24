// src/app/auth/claim/route.ts
// 링커/셀러 호스트에서 일회성 ticket 으로 공유 Domain 세션 쿠키를 심은 뒤 returnTo 로 이동한다.
import { NextRequest } from "next/server";
import { attachSharedSessionCookie } from "@/lib/auth/session-cookie";
import { verifySessionClaim } from "@/lib/auth/session-claim";

export const runtime = "nodejs";

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

function authLoginFallback(returnTo: string) {
    const authOrigin = (
        process.env.AUTH_ORIGIN ||
        process.env.NEXT_PUBLIC_AUTH_ORIGIN ||
        "https://auth.zpzp.kr"
    ).replace(/\/+$/, "");
    const u = new URL("/login", authOrigin);
    if (returnTo) u.searchParams.set("returnTo", returnTo);
    u.searchParams.set("syncFailed", "1");
    return u.toString();
}

export async function GET(req: NextRequest) {
    const ticket = req.nextUrl.searchParams.get("ticket") || "";
    const returnToRaw =
        req.nextUrl.searchParams.get("returnTo") ||
        req.nextUrl.searchParams.get("next") ||
        "";
    const returnTo = allowedReturnTo(returnToRaw);

    const verified = verifySessionClaim(ticket);
    if (!verified.ok) {
        console.error("AUTH_CLAIM_INVALID", verified.error);
        const headers = new Headers();
        headers.set("Location", authLoginFallback(returnTo || "/home"));
        return new Response(null, { status: 302, headers });
    }

    const next = allowedReturnTo(verified.payload.next) || returnTo;
    if (!next) {
        const headers = new Headers();
        headers.set("Location", authLoginFallback("/home"));
        return new Response(null, { status: 302, headers });
    }

    // ticket 의 next 와 returnTo 호스트가 다르면 거부 (오픈리다이렉트 방지)
    try {
        const nextHost = new URL(next).host.toLowerCase();
        const here = (
            req.headers.get("x-forwarded-host") ||
            req.headers.get("host") ||
            req.nextUrl.host
        )
            .split(",")[0]
            .trim()
            .toLowerCase();
        if (nextHost !== here) {
            console.error("AUTH_CLAIM_HOST_MISMATCH", { nextHost, here });
            const headers = new Headers();
            headers.set("Location", authLoginFallback(next));
            return new Response(null, { status: 302, headers });
        }
    } catch {
        const headers = new Headers();
        headers.set("Location", authLoginFallback("/home"));
        return new Response(null, { status: 302, headers });
    }

    const headers = new Headers();
    headers.set("Location", next);
    attachSharedSessionCookie(headers, req, verified.payload.sid);
    console.log("AUTH_CLAIM_OK", next);

    return new Response(null, { status: 302, headers });
}
