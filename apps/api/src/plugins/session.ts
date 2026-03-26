// apps/api/src/plugins/session.ts
import type { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import session from "@fastify/session";

export async function sessionPlugin(app: FastifyInstance) {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 16) {
        throw new Error("SESSION_SECRET is missing or too short (min 16 chars).");
    }

    const cookieDomain = process.env.COOKIE_DOMAIN || ".discountallday.kr";

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

            // ⭐ 모든 서브도메인 공유
            domain: cookieDomain,

            // ⭐ 핵심: 무조건 none
            sameSite: "none",

            // ⭐ 핵심: 무조건 true (HTTPS 환경 필수)
            secure: true,

            maxAge: 60 * 60 * 24 * 7,
        },
        saveUninitialized: false,
    });

    app.log.info(
        {
            cookieName: "dad_admin_sid",
            cookieDomain,
            sameSite: "none",
            secure: true,
        },
        "session cookie config"
    );
}