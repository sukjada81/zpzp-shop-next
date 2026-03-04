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

function getForwardedProto(req: NextRequest) {
    return (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
}

function isHttpsRequest(req: NextRequest) {
    const xfProto = getForwardedProto(req);
    if (xfProto) return xfProto === "https";
    return req.nextUrl.protocol === "https:";
}

function isLikelyLocalHost(host: string) {
    const h = (host || "").split(",")[0].trim().toLowerCase();
    const hostOnly = h.split(":")[0];
    if (!hostOnly) return true;
    if (hostOnly === "localhost") return true;
    if (hostOnly.endsWith(".localhost")) return true;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly)) return true; // IP
    return false;
}

function cookieDomainForShare(req: NextRequest) {
    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
    if (isLikelyLocalHost(host)) return undefined;
    return process.env.COOKIE_DOMAIN || ".discountallday.kr";
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const tenant = (url.searchParams.get("tenant") || "").toLowerCase().trim();

    if (!isValidTenant(tenant)) {
        return NextResponse.redirect(new URL("/select-tenant", req.url));
    }

    // 내부 라우트는 /{tenant}/home로 보내기 (subdomain 모드면 middleware가 a/b/c에서 처리)
    const res = NextResponse.redirect(new URL(`/${tenant}/home`, req.url));

    const https = isHttpsRequest(req);
    const sameSite = https ? ("none" as const) : ("lax" as const);
    const secure = https;
    const domain = cookieDomainForShare(req);

    res.cookies.set("selectedTenant", tenant, {
        path: "/",
        httpOnly: true,
        sameSite,
        secure,
        domain, // ✅ 서브도메인 공유
        maxAge: 60 * 60 * 24 * 30,
    });

    return res;
}