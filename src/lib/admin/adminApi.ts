// src/lib/admin/adminApi.ts
import { headers } from "next/headers";
import type {
    AdminDashboardDto,
    AdminListResponse,
    AdminOrderItem,
    AdminPointItem,
    AdminProductItem,
    AdminTenant,
} from "./types";

function getBaseUrl() {
    return (
        process.env.NEXT_INTERNAL_ORIGIN ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://127.0.0.1:3000")
    );
}

/**
 * 현재 요청의 쿠키를 그대로 전달
 */
async function getCookieHeader(): Promise<string> {
    const reqHeaders = await headers();
    return reqHeaders.get("cookie") ?? "";
}

async function fetchJson<T>(
    path: string,
    params?: Record<string, string | undefined>,
    init?: RequestInit
): Promise<T> {
    const baseUrl = getBaseUrl();
    const url = new URL(path, baseUrl);

    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v != null && String(v).length > 0) {
                url.searchParams.set(k, String(v));
            }
        }
    }

    const cookieHeader = await getCookieHeader();

    const mergedHeaders = new Headers(init?.headers || {});
    if (cookieHeader) {
        mergedHeaders.set("cookie", cookieHeader);
    }
    if (!mergedHeaders.has("accept")) {
        mergedHeaders.set("accept", "application/json");
    }

    const res = await fetch(url.toString(), {
        ...init,
        method: init?.method || "GET",
        headers: mergedHeaders,
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Admin API failed: ${url.pathname} HTTP ${res.status} ${text}`);
    }

    return (await res.json()) as T;
}

export async function getAdminTenants(): Promise<AdminTenant[]> {
    const json = await fetchJson<any>("/api/admin/tenants");
    return (json?.tenants ?? json?.rows ?? []) as AdminTenant[];
}

export async function getAdminDashboard(tenant: string): Promise<AdminDashboardDto> {
    return fetchJson<AdminDashboardDto>("/api/admin/dashboard", { tenant: tenant || "all" });
}

export async function getAdminProducts(params: {
    tenant?: string;
    page?: string;
    pageSize?: string;
    q?: string;
    status?: string;
}): Promise<AdminListResponse<AdminProductItem>> {
    return fetchJson<AdminListResponse<AdminProductItem>>("/api/admin/products", {
        tenant: params.tenant ?? "all",
        page: params.page ?? "1",
        pageSize: params.pageSize ?? "20",
        q: params.q,
        status: params.status,
    });
}

export async function getAdminOrders(params: {
    tenant?: string;
    page?: string;
    pageSize?: string;
    q?: string;
    status?: string;
}): Promise<AdminListResponse<AdminOrderItem>> {
    return fetchJson<AdminListResponse<AdminOrderItem>>("/api/admin/orders", {
        tenant: params.tenant ?? "all",
        page: params.page ?? "1",
        pageSize: params.pageSize ?? "20",
        q: params.q,
        status: params.status,
    });
}

export async function getAdminPoints(params: {
    tenant?: string;
    page?: string;
    pageSize?: string;
    q?: string;
    type?: string;
}): Promise<AdminListResponse<AdminPointItem>> {
    return fetchJson<AdminListResponse<AdminPointItem>>("/api/admin/points", {
        tenant: params.tenant ?? "all",
        page: params.page ?? "1",
        pageSize: params.pageSize ?? "20",
        q: params.q,
        type: params.type,
    });
}

export async function getAdminProductDetail(id: string) {
    return fetchJson<{ ok: true; product: any }>(`/api/admin/products/${id}`);
}