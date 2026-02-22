// src/app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function safeTenant(t: string) {
    // "undefined", "null" 같은 문자열도 방어
    if (!t) return "";
    const v = t.trim();
    if (v === "undefined" || v === "null") return "";
    return v;
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const tenant = safeTenant(url.searchParams.get("tenant") || "");

    const redirectTo = tenant ? `/${tenant}/login` : "/";

    const res = NextResponse.redirect(new URL(redirectTo, url.origin), { status: 302 });

    // mock 쿠키 제거
    res.cookies.set("mockLogin", "", { httpOnly: true, path: "/", maxAge: 0 });
    res.cookies.set("mockTenant", "", { httpOnly: true, path: "/", maxAge: 0 });

    return res;
}