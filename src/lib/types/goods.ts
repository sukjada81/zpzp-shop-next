// src/lib/types/goods.ts

export type PublicProductListItem = {
    id: string;
    title: string;
    price: number;
    metaLeft?: string;
    metaRight?: string;
    thumbnailUrl?: string;
    sourceTenantId?: string | null;
    cate?: string | null;
    icon?: string;
    optionUse?: number;
    saleStartAt?: string | null;
    saleEndAt?: string | null;
    pickupStartAt?: string | null;
    pickupEndAt?: string | null;
    pickupNote?: string | null;
};

export type PublicProductsResponse = {
    ok: true;
    tenant?: string;
    type?: string | null;
    category?: string | null;
    cate?: number | null;
    items: PublicProductListItem[];
};

export type PublicProductDetailResponse = {
    ok: true;
    tenant?: string;
    product: {
        id: string;
        title: string;
        price: number;
        description?: string | null;
        meta?: {
            timeLeft?: string;
            pickup?: string;
            pickupStartAt?: string | null;
            pickupEndAt?: string | null;
            pickupNote?: string | null;
        };
        images: { key: string; label?: string }[];
        options: Array<{
            id: string;
            name: string;
            price: number | null;
            soldout?: boolean;
            stockNote?: string;
            rawOptionId?: number | string;
        }>;
        sourceTenantId?: string | null;
        saleStartAt?: string | null;
        saleEndAt?: string | null;
    };
};