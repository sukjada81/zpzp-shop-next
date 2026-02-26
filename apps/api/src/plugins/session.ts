// apps/api/src/plugins/session.ts
import type { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import session from "@fastify/session";

export async function sessionPlugin(app: FastifyInstance) {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 16) {
        throw new Error("SESSION_SECRET is missing or too short (min 16 chars).");
    }

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
            sameSite: "lax",
            secure: false, // 로컬 dev에서는 false
            // ✅ domain 지정하지 말 것(특히 localhost)
            maxAge: 60 * 60 * 24 * 7,
        },
        saveUninitialized: false,
    });
}