// src/app/api/auth/kakao/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

function base64url(input: Buffer | string) {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signState(payloadJson: string, secret: string) {
    const sig = crypto.createHmac("sha256", secret).update(payloadJson).digest();
    return `${base64url(payloadJson)}.${base64url(sig)}`;
}

function getAuthOrigin(req: NextRequest) {
    const env = process.env.AUTH_ORIGIN || process.env.MAIN_ORIGIN;
    if (env) return env;

    const xfProto = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
    const xfHost = (req.headers.get("x-forwarded-host") || "").split(",")[0].trim();
    const host = (req.headers.get("host") || "").trim();
    const proto = xfProto || "http";
    const hostname = xfHost || host;
    return hostname ? `${proto}://${hostname}` : "http://localhost:3000";
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);

    const tenant = url.searchParams.get("tenant") || "";

    const SELECT_TENANT_ORIGIN = process.env.SELECT_TENANT_ORIGIN || "https://select-tenant.discountallday.kr";
    const returnTo = url.searchParams.get("returnTo") || new URL("/", SELECT_TENANT_ORIGIN).toString();

    const auto = url.searchParams.get("auto") === "1";

    const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID;
    const AUTH_STATE_SECRET = process.env.AUTH_STATE_SECRET;

    if (!KAKAO_CLIENT_ID || !AUTH_STATE_SECRET) {
        return NextResponse.json(
            { ok: false, error: "Missing env. Required: KAKAO_CLIENT_ID, AUTH_STATE_SECRET" },
            { status: 500 }
        );
    }

    const AUTH_ORIGIN = getAuthOrigin(req);
    const redirectUri = new URL("/api/auth/kakao/callback", AUTH_ORIGIN).toString();

    const payload = {
        tenant,
        returnTo,
        nonce: crypto.randomUUID(),
        ts: Date.now(),
    };

    const state = signState(JSON.stringify(payload), AUTH_STATE_SECRET);

    const kakaoAuthURL =
        `https://kauth.kakao.com/oauth/authorize` +
        `?client_id=${encodeURIComponent(KAKAO_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&state=${encodeURIComponent(state)}` +
        (auto ? `&prompt=none` : ``);

    return NextResponse.redirect(kakaoAuthURL, { status: 302 });
}