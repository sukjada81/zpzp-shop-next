// src/lib/admin/adminApi.ts
import type {
    AdminDashboardDto,
    AdminListResponse,
    AdminOrderItem,
    AdminPointItem,
    AdminProductItem,
    AdminTenant,
} from "./types";

function getBaseUrl() {
    const env =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.VERCEL_URL;

    if (env) {
        if (env.startsWith("http")) return env;
        return `https://${env}`;
    }
    return "http://localhost:3000";
}

async function fetchJson<T>(path: string, params?: Record<string, string | undefined>) {
    const baseUrl = getBaseUrl();
    const url = new URL(path, baseUrl);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v != null && String(v).length > 0) url.searchParams.set(k, String(v));
        }
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Admin API failed: ${url.pathname} HTTP ${res.status} ${text}`);
    }
    return (await res.json()) as T;
}

export async function getAdminTenants(): Promise<AdminTenant[]> {
    const json = await fetchJson<{ ok: true; tenants: AdminTenant[] }>("/api/proxy/admin/v1/tenants");
    return json.tenants ?? [];
}

export async function getAdminDashboard(tenant: string): Promise<AdminDashboardDto> {
    return fetchJson<AdminDashboardDto>("/api/proxy/admin/v1/dashboard", { tenant: tenant || "all" });
}

export async function getAdminProducts(params: {
    tenant?: string;
    page?: string;
    pageSize?: string;
    q?: string;
    status?: string;
}): Promise<AdminListResponse<AdminProductItem>> {
    return fetchJson<AdminListResponse<AdminProductItem>>("/api/proxy/admin/v1/page.tsx", {
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
    return fetchJson<AdminListResponse<AdminOrderItem>>("/api/proxy/admin/v1/orders", {
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
    // points는 서버에서 status 파라미터를 type 필터로 재사용
    return fetchJson<AdminListResponse<AdminPointItem>>("/api/proxy/admin/v1/points", {
        tenant: params.tenant ?? "all",
        page: params.page ?? "1",
        pageSize: params.pageSize ?? "20",
        q: params.q,
        status: params.type,
    });
}