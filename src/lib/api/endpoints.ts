// src/lib/api/endpoints.ts
function apiProxy(path: string) {
    const p = path.replace(/^\//, "");
    return `/api/proxy/${p}`;
}

/**
 * 브라우저에서 /api/proxy 를 부를 때 붙이는 tenant 명시 헤더.
 *
 * 왜 필요한가 — proxy 의 resolveTenant 우선순위는 헤더 > 호스트 > 경로 > 쿠키다
 * (src/app/api/proxy/[...path]/route.ts). 링커 서브도메인(예: ztest-linker-a.zpzp.kr)에서는
 * 호스트에서 뽑힌 링커 slug 가 경로의 tenant 를 이겨서 x-tenant-slug 로 올라가는데,
 * API 는 링커 slug 를 tenant 로 모른다 → 400 TENANT_NOT_RESOLVED.
 * 페이지·서버사이드 fetch 는 내부 origin(127.0.0.1)이라 호스트가 걸러져 멀쩡하고,
 * 브라우저에서 직접 부르는 호출만 깨진다.
 *
 * 값의 출처 — 하드코딩이 아니라 **현재 페이지의 라우트 tenant 파라미터**다.
 * (site)/[tenant]/... 의 그 값이며, 링커 스토어는 미들웨어가 /hq 로 rewrite 하므로
 * 실질적으로 "hq"(본사몰 카탈로그)가 들어간다. 즉 지금은 카탈로그가 hq 하나뿐이라
 * 결과적으로 hq 고정이지만, 코드는 tenant 를 그대로 전달하므로
 * **멀티 카탈로그로 확장되면 이 함수는 그대로 두고 rewrite 대상만 바뀌면 된다.**
 * 링커별로 다른 카탈로그를 붙이게 되면 바꿀 지점은 미들웨어의 rewrite 규칙과
 * zpzp_linker.tenant_id 해석이지 여기가 아니다.
 */
export function tenantHeader(tenant: string): Record<string, string> {
    const t = String(tenant ?? "").trim();
    return t ? { "x-tenant-slug": t } : {};
}

export const endpoints = {
    publicTenant: (tenant: string) => apiProxy(`${tenant}/v1/public/tenant`),

    publicProducts: (
        tenant: string,
        q?: {
            q?: string;
            take?: number;
            /** 무한 스크롤 페이징 offset. 0은 기본값이라 굳이 붙이지 않는다. */
            skip?: number;
            cursor?: string;
            type?: "today" | "pickup" | "ongoing";
        }
    ) => {
        const url = new URL(apiProxy(`${tenant}/v1/public/products`), "http://local");
        if (q?.q) url.searchParams.set("q", q.q);
        if (q?.take) url.searchParams.set("take", String(q.take));
        if (q?.skip) url.searchParams.set("skip", String(q.skip));
        if (q?.cursor) url.searchParams.set("cursor", q.cursor);
        if (q?.type) url.searchParams.set("type", q.type);
        return url.pathname + (url.search ? url.search : "");
    },

    publicProductDetail: (tenant: string, id: string | number) =>
        apiProxy(`${tenant}/v1/public/products/${id}`),

    createOrder: (tenant: string) => apiProxy(`${tenant}/v1/orders`),

    /** Toss PG — shop-php toss_* .php 대응 (셀러 스토어프론트) */
    tossClientKey: (tenant: string) => apiProxy(`${tenant}/v1/payments/toss/client-key`),
    tossPrepare: (tenant: string) => apiProxy(`${tenant}/v1/payments/toss/prepare`),
    tossConfirm: (tenant: string) => apiProxy(`${tenant}/v1/payments/toss/confirm`),

    publicRecentOrders: (tenant: string, q?: { take?: number }) => {
        const url = new URL(apiProxy(`${tenant}/v1/orders/recent`), "http://local");
        if (q?.take) url.searchParams.set("take", String(q.take));
        return url.pathname + (url.search ? url.search : "");
    },

    publicOngoingProducts: (tenant: string, q?: { take?: number }) => {
        const url = new URL(apiProxy(`${tenant}/v1/public/products`), "http://local");
        url.searchParams.set("type", "ongoing");
        if (q?.take) url.searchParams.set("take", String(q.take));
        return url.pathname + (url.search ? url.search : "");
    },

    myOrders: (tenant: string, q?: { page?: number; limit?: number }) => {
        const url = new URL(apiProxy(`${tenant}/v1/orders/me`), "http://local");
        if (q?.page) url.searchParams.set("page", String(q.page));
        if (q?.limit) url.searchParams.set("limit", String(q.limit));
        return url.pathname + (url.search ? url.search : "");
    },

    myOrderDetail: (tenant: string, orderNum: string) =>
        apiProxy(`${tenant}/v1/orders/${encodeURIComponent(orderNum)}`),

    cancelOrder: (tenant: string, orderNum: string) =>
        apiProxy(`${tenant}/v1/orders/${encodeURIComponent(orderNum)}/cancel`),

    cancelOrderItem: (tenant: string, orderNum: string, orderGoodsUid: string | number) =>
        apiProxy(
            `${tenant}/v1/orders/${encodeURIComponent(orderNum)}/items/${encodeURIComponent(String(orderGoodsUid))}/cancel`
        ),

    cancelOrderItemRequest: (tenant: string, orderNum: string, orderGoodsUid: string | number) =>
        apiProxy(
            `${tenant}/v1/orders/${encodeURIComponent(orderNum)}/items/${encodeURIComponent(String(orderGoodsUid))}/cancel-request`
        ),

    withdrawCancelOrderItemRequest: (
        tenant: string,
        orderNum: string,
        orderGoodsUid: string | number
    ) =>
        apiProxy(
            `${tenant}/v1/orders/${encodeURIComponent(orderNum)}/items/${encodeURIComponent(String(orderGoodsUid))}/cancel-request/withdraw`
        ),

    confirmOrderItem: (tenant: string, orderNum: string, orderGoodsUid: string | number) =>
        apiProxy(
            `${tenant}/v1/orders/${encodeURIComponent(orderNum)}/items/${encodeURIComponent(String(orderGoodsUid))}/confirm`
        ),

    claimOrderItem: (tenant: string, orderNum: string, orderGoodsUid: string | number) =>
        apiProxy(
            `${tenant}/v1/orders/${encodeURIComponent(orderNum)}/items/${encodeURIComponent(String(orderGoodsUid))}/claim`
        ),

    withdrawClaimOrderItem: (tenant: string, orderNum: string, orderGoodsUid: string | number) =>
        apiProxy(
            `${tenant}/v1/orders/${encodeURIComponent(orderNum)}/items/${encodeURIComponent(String(orderGoodsUid))}/claim/withdraw`
        ),

    claimOrder: (tenant: string, orderNum: string) =>
        apiProxy(`${tenant}/v1/orders/${encodeURIComponent(orderNum)}/claim`),

    confirmOrder: (tenant: string, orderNum: string) =>
        apiProxy(`${tenant}/v1/orders/${encodeURIComponent(orderNum)}/confirm`),

    guestOrders: (tenant: string) => apiProxy(`${tenant}/v1/orders/guest/list`),

    guestOrderDetail: (tenant: string, orderNum: string, phone: string) => {
        const url = new URL(
            apiProxy(`${tenant}/v1/orders/guest/${encodeURIComponent(orderNum)}`),
            "http://local"
        );
        url.searchParams.set("phone", phone);
        return url.pathname + (url.search ? url.search : "");
    },

    guestCancelOrder: (tenant: string, orderNum: string) =>
        apiProxy(`${tenant}/v1/orders/guest/${encodeURIComponent(orderNum)}/cancel`),
};