// src/app/api/tenant/select/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getTenantList } from "@/lib/tenant/tenants";

export const runtime = "nodejs";

function isValidTenant(slug: string) {
    const s = (slug || "").toLowerCase().trim();
    if (!s) return false;
    const list = getTenantList();
    return list.some((t) => (t.slug || "").toLowerCase() === s);
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const tenant = (url.searchParams.get("tenant") || "").toLowerCase().trim();

    if (!isValidTenant(tenant)) {
        return NextResponse.redirect(new URL("/select-tenant", req.url));
    }

    // ✅ active tenant(현재 지점) 쿠키 저장
    // (기존 쿠키명 selectedTenant 유지)
    const res = NextResponse.redirect(new URL(`/${tenant}/home`, req.url));

    res.cookies.set("selectedTenant", tenant, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        // 운영에서 https면 secure: true 권장
        secure: false,
        maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return res;
}