// src/lib/types/goods.ts

export type PublicProductItem = {
    id: string | number;
    title: string;
    price: number;
    badgeLeft?: string;
    badgeRight?: string;
    metaLeft?: string;
    metaRight?: string;
    thumbnailUrl?: string; // ✅ 썸네일 URL(절대/상대 모두 가능)
};

export type PublicProductsResponse = {
    ok: true;
    tenant?: string;
    items: PublicProductItem[];
};

export type ProductDetailResponse = {
    ok: true;
    tenant?: string;
    product: {
        id: string | number;
        title: string;
        price: number;
        description?: string | null;
        badges?: { left?: string; right?: string };
        meta?: { timeLeft?: string; pickup?: string };
        images?: { key: string; label?: string }[];
        options?: Array<{
            id: string | number;
            name: string;
            price: number | null;
            soldout?: boolean;
            stockNote?: string;
        }>;
        notices?: { icon?: string; text: string }[];
    };
};