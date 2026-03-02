// src/app/api/auth/kakao/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

function base64url(input: Buffer | string) {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return buf
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

function signState(payloadJson: string, secret: string) {
    const sig = crypto.createHmac("sha256", secret).update(payloadJson).digest();
    return `${base64url(payloadJson)}.${base64url(sig)}`;
}

/**
 * ✅ 프록시/ngrok 환경에서 origin을 정확히 잡기 위해
 * x-forwarded-host / x-forwarded-proto를 우선 사용합니다.
 */
function getRequestOrigin(req: NextRequest) {
    const xfProto = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
    const xfHost = (req.headers.get("x-forwarded-host") || "").split(",")[0].trim();
    const host = (req.headers.get("host") || "").trim();

    const proto = xfProto || "http";
    const hostname = xfHost || host;

    // fallback
    if (!hostname) return "http://localhost:3000";
    return `${proto}://${hostname}`;
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);

    const tenant = url.searchParams.get("tenant") || "";
    const returnTo = url.searchParams.get("returnTo") || "/home";

    // ✅ auto=1 → prompt=none
    const auto = url.searchParams.get("auto") === "1";

    const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID;
    const AUTH_STATE_SECRET = process.env.AUTH_STATE_SECRET;

    if (!KAKAO_CLIENT_ID || !AUTH_STATE_SECRET) {
        return NextResponse.json(
            {
                ok: false,
                error: "Missing env. Required: KAKAO_CLIENT_ID, AUTH_STATE_SECRET",
            },
            { status: 500 }
        );
    }

    // ✅ redirect_uri를 동적으로 생성 (현재 도메인 유지: localhost/ngrok/배포 모두 OK)
    // - req.url은 내부적으로 http로 들어올 수 있어서 forwarded 헤더 기반 origin을 사용
    const origin = getRequestOrigin(req);
    const redirectUri = new URL("/api/auth/kakao/callback", origin).toString();

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