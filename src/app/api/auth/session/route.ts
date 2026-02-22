// src/app/api/auth/session/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const mockLogin = req.cookies.get("mockLogin")?.value === "1";
    const mockTenant = req.cookies.get("mockTenant")?.value || "";

    return NextResponse.json({
        ok: true,
        loggedIn: mockLogin,
        tenant: mockTenant,
        // 프론트-only 단계: 유저 프로필은 settings(localStorage)에서 채워서 보여줄 거라 여기선 최소만
        user: mockLogin ? { id: "mock", provider: "kakao" } : null,
    });
}