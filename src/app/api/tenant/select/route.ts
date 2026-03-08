// src/app/api/tenant/select/page.tsx
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

function buildTenantHomeAbs(tenant: string) {
    const baseDomain = process.env.TENANT_BASE_DOMAIN || "discountallday.kr";
    return `https://${tenant}.${baseDomain}/home`;
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const tenant = (url.searchParams.get("tenant") || "").toLowerCase().trim();

    if (!isValidTenant(tenant)) {
        return NextResponse.redirect(new URL("/select-tenant", req.url));
    }

    const https = isHttpsRequest(req);
    const sameSite = https ? ("none" as const) : ("lax" as const);
    const secure = https;
    const domain = cookieDomainForShare(req);

    // ✅ tenant 확정 쿠키
    // - 서브도메인 공유를 위해 domain 설정(운영)
    // - 로컬/IP는 domain 미설정(브라우저 정책)
    const ENABLE_SUBDOMAIN_TENANT = process.env.TENANT_BY_SUBDOMAIN === "1";

    // ✅ redirect 목적지 결정:
    // - 서브도메인 모드(운영): https://a.discountallday.kr/home 로 보내야 select-tenant host에서 안 막힘
    // - path 모드/로컬: /a/home 로 보내면 됨
    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
    const localLike = isLikelyLocalHost(host);

    const dest = ENABLE_SUBDOMAIN_TENANT && !localLike
        ? buildTenantHomeAbs(tenant)
        : new URL(`/${tenant}/home`, req.url).toString();

    const res = NextResponse.redirect(dest);

    res.cookies.set("selectedTenant", tenant, {
        path: "/",
        httpOnly: true,
        sameSite,
        secure,
        domain,
        maxAge: 60 * 60 * 24 * 30,
    });

    return res;
}