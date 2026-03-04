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
        user: mockLogin ? { id: "mock", provider: "kakao" } : null,
    });
}