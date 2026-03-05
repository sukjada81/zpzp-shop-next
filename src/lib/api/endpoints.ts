// src/lib/api/endpoints.ts

function apiProxy(path: string) {
    const p = path.replace(/^\//, "");
    return `/api/proxy/${p}`;
}

export const endpoints = {
    // --------
    // Public (고객)
    // --------
    publicProducts: (tenant: string, q?: { q?: string; take?: number; cursor?: string }) => {
        const url = new URL(apiProxy(`${tenant}/v1/public/products`), "http://local");
        if (q?.q) url.searchParams.set("q", q.q);
        if (q?.take) url.searchParams.set("take", String(q.take));
        if (q?.cursor) url.searchParams.set("cursor", q.cursor);
        return url.pathname + (url.search ? url.search : "");
    },

    publicProductDetail: (tenant: string, id: string | number) => apiProxy(`${tenant}/v1/public/products/${id}`),

    // --------
    // (다음 단계) Orders / Admin는 여기 계속 추가
    // --------
    // createOrder: (tenant: string) => apiProxy(`${tenant}/v1/orders`),
    // myOrders: (tenant: string) => apiProxy(`${tenant}/v1/orders/me`),
};