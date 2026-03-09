// src/app/api/auth/session/page.tsx
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getHost(req: NextRequest) {
    return (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
        .split(",")[0]
        .trim()
        .toLowerCase();
}

function isLikelyLocalHost(host: string) {
    const h = (host || "").toLowerCase();
    const hostOnly = h.split(":")[0];
    if (!hostOnly) return true;
    if (hostOnly === "localhost") return true;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly)) return true;
    if (h.includes(":3000") || h.includes(":5173") || h.includes(":8080")) return true;
    return false;
}

export async function GET(req: NextRequest) {
    const host = getHost(req);

    const LOCAL_BYPASS_AUTH = process.env.LOCAL_BYPASS_AUTH === "1";
    const bypassAuth = LOCAL_BYPASS_AUTH && isLikelyLocalHost(host);

    const mockLoginCookie = req.cookies.get("mockLogin")?.value === "1";
    const mockTenant = req.cookies.get("mockTenant")?.value || "";

    const loggedIn = bypassAuth ? true : mockLoginCookie;

    return NextResponse.json({
        ok: true,
        loggedIn,
        tenant: mockTenant,
        user: loggedIn ? { id: bypassAuth ? "local-dev" : "mock", provider: "kakao" } : null,
        dev: { bypassAuth, host },
    });
}