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

export async function GET(req: NextRequest) {
    const url = new URL(req.url);

    const tenant = url.searchParams.get("tenant") || "";
    const returnTo = url.searchParams.get("returnTo") || "/home";

    // ✅ auto=1 → prompt=none
    const auto = url.searchParams.get("auto") === "1";

    const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID;
    const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI;
    const AUTH_STATE_SECRET = process.env.AUTH_STATE_SECRET;

    if (!KAKAO_CLIENT_ID || !KAKAO_REDIRECT_URI || !AUTH_STATE_SECRET) {
        return NextResponse.json(
            {
                ok: false,
                error: "Missing env. Required: KAKAO_CLIENT_ID, KAKAO_REDIRECT_URI, AUTH_STATE_SECRET",
            },
            { status: 500 }
        );
    }

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
        `&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}` +
        `&response_type=code` +
        `&state=${encodeURIComponent(state)}` +
        (auto ? `&prompt=none` : ``);

    return NextResponse.redirect(kakaoAuthURL);
}