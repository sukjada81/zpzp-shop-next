// src/lib/tenant/getTenant.ts
import { endpoints } from "@/lib/api/endpoints";

export function normalizeTenant(raw: string) {
    const t = (raw || "").trim();
    if (!t || t.toLowerCase() === "undefined" || t.toLowerCase() === "null") return "";
    return t;
}

export function tenantFromPathname(pathname: string) {
    const seg =
        (pathname || "")
            .split("?")[0]
            .split("#")[0]
            .split("/")
            .filter(Boolean)[0] || "";
    return normalizeTenant(seg);
}

export function tenantFromParams(params: any) {
    const t = params?.tenant;
    if (typeof t === "string") return normalizeTenant(t);
    return "";
}

export async function getTenantBySlug(rawSlug: string) {
    const slug = normalizeTenant(rawSlug);
    if (!slug) return null;

    const res = await fetch(endpoints.tenantBySlug(slug), {
        cache: "no-store",
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.ok || !data?.item) return null;

    return data.item as {
        id: number;
        slug: string;
        name: string;
        status?: string;
        timezone?: string | null;
        primary_domain?: string | null;
    };
}