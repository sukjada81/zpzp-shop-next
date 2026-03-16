// src/app/auth/kakao/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

function base64url(input: Buffer | string) {
    return Buffer.from(input)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function signState(payload: Record<string, unknown>, secret: string) {
    const json = JSON.stringify(payload);
    const encoded = base64url(json);
    const sig = crypto.createHmac("sha256", secret).update(json).digest();
    return `${encoded}.${base64url(sig)}`;
}

function safeTenantSlug(raw: string) {
    const t = String(raw || "").trim().toLowerCase();
    if (!t) return "";
    if (!/^[a-z0-9-]+$/.test(t)) return "";
    return t;
}

export async function GET(req: NextRequest) {
    const kakaoClientId = process.env.KAKAO_CLIENT_ID || "";
    const authOrigin = process.env.AUTH_ORIGIN || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const authStateSecret = process.env.AUTH_STATE_SECRET || "";

    if (!kakaoClientId || !authStateSecret) {
        return NextResponse.json(
            { ok: false, error: "Missing KAKAO_CLIENT_ID or AUTH_STATE_SECRET" },
            { status: 500 }
        );
    }

    const tenant = safeTenantSlug(req.nextUrl.searchParams.get("tenant") || "a");
    const returnTo = req.nextUrl.searchParams.get("returnTo") || "/home";
    const auto = req.nextUrl.searchParams.get("auto") || "0";

    const redirectUri = new URL("/auth/kakao/callback", authOrigin).toString();

    const state = signState(
        {
            tenant,
            returnTo,
            nonce: crypto.randomUUID(),
            ts: Date.now(),
        },
        authStateSecret
    );

    const authorizeUrl = new URL("https://kauth.kakao.com/oauth/authorize");
    authorizeUrl.searchParams.set("client_id", kakaoClientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("state", state);

    // 기존 회원은 scope 동일하면 동의창 스킵
    authorizeUrl.searchParams.set("scope", ["profile_nickname", "profile_image"].join(" "));

    if (auto === "1") {
        // 자동 세션 복구용
        authorizeUrl.searchParams.set("prompt", "none");
    } else {
        // 수동 로그인 버튼은 자동 로그인 강제 방지
        authorizeUrl.searchParams.set("prompt", "login");
    }

    return NextResponse.redirect(authorizeUrl.toString(), { status: 302 });
}