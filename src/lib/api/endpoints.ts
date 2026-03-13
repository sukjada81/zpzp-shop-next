// src/lib/api/endpoints.ts

function apiProxy(path: string) {
    const p = path.replace(/^\//, "");
    return `/api/proxy/${p}`;
}

export const endpoints = {
    // --------
    // Public (고객)
    // --------
    publicProducts: (
        tenant: string,
        q?: {
            q?: string;
            take?: number;
            cursor?: string;
            type?: "today" | "pickup" | "ongoing";
        }
    ) => {
        const url = new URL(apiProxy(`${tenant}/v1/public/products`), "http://local");
        if (q?.q) url.searchParams.set("q", q.q);
        if (q?.take) url.searchParams.set("take", String(q.take));
        if (q?.cursor) url.searchParams.set("cursor", q.cursor);
        if (q?.type) url.searchParams.set("type", q.type);
        return url.pathname + (url.search ? url.search : "");
    },

    publicProductDetail: (tenant: string, id: string | number) =>
        apiProxy(`${tenant}/v1/public/products/${id}`),

    createOrder: (tenant: string) =>
        apiProxy(`${tenant}/v1/orders`),

    myOrders: (tenant: string, q?: { page?: number; limit?: number }) => {
        const url = new URL(apiProxy(`${tenant}/v1/orders/me`), "http://local");
        if (q?.page) url.searchParams.set("page", String(q.page));
        if (q?.limit) url.searchParams.set("limit", String(q.limit));
        return url.pathname + (url.search ? url.search : "");
    },

    myOrderDetail: (tenant: string, orderNum: string) =>
        apiProxy(`${tenant}/v1/orders/${encodeURIComponent(orderNum)}`),
};