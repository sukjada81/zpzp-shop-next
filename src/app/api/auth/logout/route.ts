// src/app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function safeTenant(t: string) {
    if (!t) return "";
    const v = t.trim().toLowerCase();
    if (v === "undefined" || v === "null") return "";
    return v;
}

/**
 * ✅ ngrok/프록시 환경에서 origin이 localhost로 잡히는 문제 방지
 * - x-forwarded-proto / x-forwarded-host 우선
 */
function getRequestOrigin(req: NextRequest) {
    const xfProto = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
    const xfHost = (req.headers.get("x-forwarded-host") || "").split(",")[0].trim();
    const host = (req.headers.get("host") || "").trim();

    const proto = xfProto || "http";
    const hostname = xfHost || host;

    if (!hostname) return "http://localhost:3000";
    return `${proto}://${hostname}`;
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const tenant = safeTenant(url.searchParams.get("tenant") || "");

    // ✅ tenant가 없으면 "/"로 보내지 말고(404 가능), 항상 있는 지점선택으로 이동
    const redirectPath = tenant ? `/${tenant}/login` : "/select-tenant";

    const origin = getRequestOrigin(req);
    const res = NextResponse.redirect(new URL(redirectPath, origin), { status: 302 });

    // mock 쿠키 제거
    res.cookies.set("mockLogin", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
    res.cookies.set("mockTenant", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });

    // ✅ 선택 지점도 로그아웃 시 초기화(원하면 유지해도 됨)
    res.cookies.set("selectedTenant", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });

    return res;
}