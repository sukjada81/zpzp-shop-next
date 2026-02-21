// src/app/api/auth/kakao/callback/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get("code");

    if (!code) {
        return NextResponse.json({ error: "No code" }, { status: 400 });
    }

    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: process.env.KAKAO_CLIENT_ID!,
            redirect_uri: process.env.KAKAO_REDIRECT_URI!,
            client_secret: process.env.KAKAO_CLIENT_SECRET!,
            code,
        }),
    });

    const tokenData = await tokenRes.json();

    const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
        },
    });

    const userData = await userRes.json();

    // 🔥 여기서 PHP API 호출 (회원 조회/가입)
    // TODO: PHP 연동 예정

    // 임시 로그인 완료 처리
    const response = NextResponse.redirect(
        new URL("/home", req.url)
    );

    response.cookies.set("mockLogin", "1", {
        httpOnly: true,
        path: "/",
    });

    return response;
}