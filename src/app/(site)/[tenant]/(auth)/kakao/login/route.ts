// src/app/api/auth/kakao/login/route.ts
import { NextResponse } from "next/server";

export async function GET() {
    const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID!;
    const REDIRECT_URI = process.env.KAKAO_REDIRECT_URI!;

    const kakaoAuthURL =
        `https://kauth.kakao.com/oauth/authorize` +
        `?client_id=${KAKAO_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code`;

    return NextResponse.redirect(kakaoAuthURL);
}