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

function getRequestOrigin(req: NextRequest) {
    const xfProto = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
    const xfHost = (req.headers.get("x-forwarded-host") || "").split(",")[0].trim();
    const host = (req.headers.get("host") || "").trim();

    const proto = xfProto || "http";
    const hostname = xfHost || host;

    if (!hostname) return "http://localhost:3000";
    return `${proto}://${hostname}`;
}

/**
 * ✅ Kakao Redirect URI base는 auth.discountallday.kr 로 고정(운영)
 * - MAIN_ORIGIN=https://auth.discountallday.kr
 * - 로컬은 현재 origin 사용
 */
function getKakaoRedirectBase(req: NextRequest) {
    // ✅ 환경이 dev여도 MAIN_ORIGIN이 있으면 그걸 무조건 사용
    const MAIN_ORIGIN = process.env.MAIN_ORIGIN;
    if (MAIN_ORIGIN) return MAIN_ORIGIN;

    // fallback (로컬에서 MAIN_ORIGIN 안 둔 경우만)
    return getRequestOrigin(req);
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);

    const tenant = url.searchParams.get("tenant") || "";
    const returnTo = url.searchParams.get("returnTo") || "/home";

    const auto = url.searchParams.get("auto") === "1";

    const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID;
    const AUTH_STATE_SECRET = process.env.AUTH_STATE_SECRET;

    if (!KAKAO_CLIENT_ID || !AUTH_STATE_SECRET) {
        return NextResponse.json(
            { ok: false, error: "Missing env. Required: KAKAO_CLIENT_ID, AUTH_STATE_SECRET" },
            { status: 500 }
        );
    }

    const base = getKakaoRedirectBase(req);
    const redirectUri = new URL("/api/auth/kakao/callback", base).toString();

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