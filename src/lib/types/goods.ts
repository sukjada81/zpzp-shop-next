// src/lib/types/goods.ts

export type PublicProductOption = {
    id: string;
    name: string;
    price: number | null;
    addPrice?: number;
    qty?: number;
    qtyType?: number;
    soldout?: boolean;
    stockNote?: string;
    rawOptionId?: number | string;
    code?: string;
};

export type PublicProductImage = {
    key: string;
    label?: string;
};

export type PublicProductListItem = {
    id: string;
    title: string;
    // 비회원 마스킹(기획서 §8): 비로그인이면 서버가 price=null + masked=true 로 내림
    price: number | null;
    masked?: boolean;
    metaLeft?: string;
    metaRight?: string;
    thumbnailUrl?: string;
    images?: PublicProductImage[];
    options?: PublicProductOption[];
    sourceTenantId?: string | null;
    cate?: string | null;
    categoryLabel?: string;
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
    // 무한 스크롤 페이징 메타(구버전 API 호환을 위해 전부 옵셔널)
    total?: number;
    skip?: number;
    take?: number;
    hasMore?: boolean;
    nextSkip?: number | null;
};

export type PublicProductDetailResponse = {
    ok: true;
    tenant?: string;
    product: {
        id: string;
        title: string;
        // 비회원 마스킹(기획서 §8): 비로그인이면 서버가 price=null + masked=true, options[].price=null 로 내림
        price: number | null;
        masked?: boolean;
        description?: string | null;
        cate?: string | null;
        categoryLabel?: string;
        meta?: {
            timeLeft?: string;
            pickup?: string;
            pickupStartAt?: string | null;
            pickupEndAt?: string | null;
            pickupNote?: string | null;
        };
        images: PublicProductImage[];
        options: PublicProductOption[];
        sourceTenantId?: string | null;
        saleStartAt?: string | null;
        saleEndAt?: string | null;
    };
};