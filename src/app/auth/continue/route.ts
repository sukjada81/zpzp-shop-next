// src/app/auth/continue/route.ts
// auth.zpzp.kr 에만 붙은 세션 쿠키를 공유 도메인으로 재발급 후 returnTo 로 보낸다.
import { NextRequest } from "next/server";
import { appendApiSetCookies } from "@/lib/auth/session-cookie";

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

function getForwardedHost(req: NextRequest) {
    return getHeaderFirst(req, "x-forwarded-host") || getHeaderFirst(req, "host");
}

function getForwardedProto(req: NextRequest) {
    return getHeaderFirst(req, "x-forwarded-proto").toLowerCase();
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

        const target = /^https?:\/\//i.test(returnTo)
            ? returnTo
            : new URL(returnTo, req.nextUrl.origin).toString();

        const headers = new Headers();
        headers.set("Location", target);
        appendApiSetCookies(headers, refreshRes, req);

        console.log("AUTH_CONTINUE_REDIRECT", target);

        return new Response(null, { status: 302, headers });
    } catch (e: any) {
        console.error("AUTH_CONTINUE_FAILED", e?.message || e);
        const headers = new Headers();
        headers.set("Location", loginFallback(req, returnTo));
        return new Response(null, { status: 302, headers });
    }
}
