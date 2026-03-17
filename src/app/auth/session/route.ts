// src/app/auth/session/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getApiBase() {
    return (
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:4000"
    ).replace(/\/+$/, "");
}

function normalizeTenant(raw: unknown) {
    const t = String(raw ?? "").trim().toLowerCase();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

function getHost(req: NextRequest) {
    return (req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host || "")
        .split(",")[0]
        .trim()
        .toLowerCase();
}

function getHostOnly(host: string) {
    return (host || "").split(":")[0].trim().toLowerCase();
}

function isIp(hostOnly: string) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly);
}

function isTunnelDomain(hostOnly: string) {
    const h = hostOnly.toLowerCase();

    const blockedSuffixes = [
        "ngrok-free.dev",
        "ngrok-free.app",
        "ngrok.app",
        "ngrok.io",
        "trycloudflare.com",
        "loca.lt",
        "localtunnel.me",
    ];

    return blockedSuffixes.some((suffix) => h === suffix || h.endsWith(`.${suffix}`));
}

function isNonTenantServiceHost(hostOnly: string) {
    const h = (hostOnly || "").toLowerCase().trim();

    if (!h) return false;

    return (
        h === "localhost" ||
        h === "127.0.0.1" ||
        h === "auth.discountallday.kr" ||
        h === "select-tenant.discountallday.kr" ||
        h === "seller.discountallday.kr" ||
        h === "admin.discountallday.kr" ||
        h === "api.discountallday.kr" ||
        h === "www.discountallday.kr"
    );
}

function resolveTenantFromHost(hostOnly: string) {
    const h = (hostOnly || "").toLowerCase().trim();
    if (!h) return "";

    if (h === "localhost" || isIp(h) || isTunnelDomain(h) || isNonTenantServiceHost(h)) {
        return "";
    }

    const baseDomain = (process.env.TENANT_BASE_DOMAIN || "discountallday.kr")
        .toLowerCase()
        .trim();

    if (baseDomain) {
        if (h === baseDomain) return "";
        if (!h.endsWith(`.${baseDomain}`)) return "";

        const rest = h.slice(0, -(baseDomain.length + 1));
        const firstLabel = rest.split(".")[0] ?? "";
        return normalizeTenant(firstLabel);
    }

    const parts = h.split(".");
    if (parts.length >= 3) return normalizeTenant(parts[0]);

    return "";
}

function resolveTenant(req: NextRequest) {
    const tenantFromHeader = normalizeTenant(req.headers.get("x-tenant-slug"));
    if (tenantFromHeader) return tenantFromHeader;

    const hostOnly = getHostOnly(getHost(req));
    const tenantFromHost = resolveTenantFromHost(hostOnly);
    if (tenantFromHost) return tenantFromHost;

    return normalizeTenant(req.cookies.get("selectedTenant")?.value || "");
}

export async function GET(req: NextRequest) {
    const tenant = resolveTenant(req);

    const res = await fetch(`${getApiBase()}/v1/auth/session`, {
        method: "GET",
        headers: {
            accept: "application/json",
            cookie: req.headers.get("cookie") || "",
            ...(tenant ? { "x-tenant-slug": tenant } : {}),
            ...(req.headers.get("x-forwarded-host")
                ? { "x-forwarded-host": req.headers.get("x-forwarded-host") as string }
                : {}),
            ...(req.headers.get("x-forwarded-proto")
                ? { "x-forwarded-proto": req.headers.get("x-forwarded-proto") as string }
                : {}),
        },
        cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    return NextResponse.json({
        ok: true,
        loggedIn: Boolean(data?.loggedIn),
        member: data?.member ?? null,
        tenant: data?.member?.tenantSlug ?? tenant ?? "",
    });
}