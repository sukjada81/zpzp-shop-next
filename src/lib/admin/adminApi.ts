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

/**
 * ✅ Server Component에서 내부 API(/api/...) 호출 시
 * "현재 요청의 쿠키"를 직접 헤더로 실어줘야 세션이 유지됩니다.
 */
async function getCookieHeader(): Promise<string> {
    const h = await headers();
    return h.get("cookie") ?? "";
}

async function fetchJson<T>(
    path: string,
    params?: Record<string, string | undefined>,
    init?: RequestInit
) {
    const baseUrl = getBaseUrl();
    const url = new URL(path, baseUrl);

    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v != null && String(v).length > 0) url.searchParams.set(k, String(v));
        }
    }

    // ✅ 쿠키 전달(세션 유지 핵심)
    const cookie = await getCookieHeader();

    const res = await fetch(url.toString(), {
        cache: "no-store",
        ...init,
        headers: {
            Accept: "application/json",
            ...(cookie ? { cookie } : {}),
            ...(init?.headers ?? {}),
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Admin API failed: ${url.pathname} HTTP ${res.status} ${text}`);
    }

    return (await res.json()) as T;
}

export async function getAdminTenants(): Promise<AdminTenant[]> {
    const json = await fetchJson<{ ok: boolean; rows: AdminTenant[] }>("/api/admin/tenants");
    return (json as any).rows ?? [];
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
        limit: params.pageSize ?? "20",
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
        limit: params.pageSize ?? "20",
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
        limit: params.pageSize ?? "20",
        q: params.q,
        type: params.type,
    });
}

export async function getAdminProductDetail(id: string) {
    return fetchJson<{ ok: true; product: any }>(`/api/admin/products/${id}`);
}