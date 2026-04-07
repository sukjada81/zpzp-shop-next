// apps/api/src/plugins/session.ts
import type { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import session from "@fastify/session";

function parseHost(appUrl?: string) {
    const raw = String(appUrl || "").trim();
    if (!raw) return "";

    try {
        return new URL(raw).hostname.toLowerCase();
    } catch {
        return "";
    }
}

function isHttpAppUrl(appUrl?: string) {
    const raw = String(appUrl || "").trim().toLowerCase();
    if (!raw) return true;

    try {
        return new URL(raw).protocol.replace(":", "") === "http";
    } catch {
        return true;
    }
}

function isLocalHost(host: string) {
    const h = String(host || "").trim().toLowerCase();
    if (!h) return true;
    if (h === "localhost") return true;
    if (h === "127.0.0.1") return true;
    if (h.endsWith(".localhost")) return true;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;
    return false;
}

function shouldShareCookieDomain(host: string, cookieDomain: string) {
    const h = String(host || "").trim().toLowerCase();
    const d = String(cookieDomain || "").replace(/^\./, "").toLowerCase();

    if (!h || !d) return false;
    if (isLocalHost(h)) return false;

    return h === d || h.endsWith(`.${d}`);
}

export async function sessionPlugin(app: FastifyInstance) {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 16) {
        throw new Error("SESSION_SECRET is missing or too short (min 16 chars).");
    }

    const cookieDomain = process.env.COOKIE_DOMAIN || ".discountallday.kr";

    const appUrl =
        process.env.AUTH_ORIGIN ||
        process.env.NEXT_PUBLIC_AUTH_ORIGIN ||
        process.env.APP_ORIGIN ||
        "";

    const host = parseHost(appUrl);
    const httpLike = isHttpAppUrl(appUrl);

    // localhost / 127.0.0.1 / IP 개발환경은 host-only 쿠키
    const localHost = isLocalHost(host);

    // auth.discountallday.kr / a.discountallday.kr 같은 서브도메인 개발환경은 공유 도메인 유지
    const shareDomain = shouldShareCookieDomain(host, cookieDomain);

    const sameSite: "lax" | "none" = httpLike ? "lax" : "none";
    const secure = !httpLike;

    await app.register(cookie, {
        secret,
        hook: "onRequest",
    });

    await app.register(session, {
        secret,
        cookieName: "dad_admin_sid",
        cookie: {
            path: "/",
            httpOnly: true,
            domain: shareDomain && !localHost ? cookieDomain : undefined,
            sameSite,
            secure,
            maxAge: 60 * 60 * 24 * 7,
        },
        saveUninitialized: false,
    });

    app.log.info(
        {
            cookieName: "dad_admin_sid",
            appUrl,
            host,
            httpLike,
            localHost,
            shareDomain,
            cookieDomain: shareDomain && !localHost ? cookieDomain : undefined,
            sameSite,
            secure,
        },
        "session cookie config"
    );
}