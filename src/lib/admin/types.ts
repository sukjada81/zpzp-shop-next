// src/lib/admin/types.ts
export type AdminTenant = {
    id: string;
    slug: string;
    name: string;
    status: string;
    primaryDomain: string | null;
    timezone: string;
};

export type TenantScope =
    | { scope: "all" }
    | { scope: "single"; id: string; slug: string; name: string };

export type AdminDashboardDto = {
    ok: true;
    tenant: TenantScope;
    kpi: {
        todayOrders: number;
        todaySales: number;
        unpaid: number;
        paid: number;
        pickupsUpcoming: number;
        pointUsed: number;
    };
    recentOrders: Array<{
        tenant: { slug: string; name: string } | null;
        orderNo: string;
        buyerName: string;
        buyerPhone: string;
        status: string;
        totalAmount: number;
        pickupAt: string | null;
        createdAt: string | null;
    }>;
};

export type AdminListResponse<T> = {
    ok: true;
    tenant: TenantScope;
    page: number;
    pageSize: number;
    total: number;
    items: T[];
};

export type AdminProductItem = {
    tenant: { slug: string; name: string } | null;
    id: string;
    title: string;
    status: string;
    basePrice: number;
    thumbnailUrl: string | null;
    pickupOnly: boolean;
    minQty: number | null;
    maxQty: number | null;
    saleStartAt: string | null;
    saleEndAt: string | null;
    updatedAt: string;
};

export type AdminOrderItem = {
    tenant: { slug: string; name: string } | null;
    id: string;
    orderNo: string;
    buyerName: string;
    buyerPhone: string;
    status: string;
    paymentStatus: string;
    totalAmount: number;
    pointUsedAmount: number;
    pickupAt: string | null;
    createdAt: string;
};

export type AdminPointItem = {
    tenant: { slug: string; name: string } | null;
    id: string;
    userId: string;
    type: string;
    amount: number;
    balanceAfter: number | null;
    reason: string | null;
    orderId: string | null;
    createdAt: string;
};// src/lib/admin/types.ts

export type AdminRecentOrderRow = {
    orderNo: string;
    buyerName: string;
    buyerPhone: string;
    totalAmount: number;
    status: string;
    pickupAt?: string | null;
};