/**
 * 주문 품목 → 배송비 quote 입력 변환 + DB 조회
 *
 * validateOrderItems / prepare / order-create 가 공통으로 사용.
 */
import type { PrismaClient } from "@prisma/client";
import {
    calculateHqDeliveryFee,
    type DeliveryLineItem,
    type DeliveryQuote,
} from "./calculate-delivery.js";
import { loadShopDeliveryConfig } from "./delivery-config.js";

export type OrderDeliveryItemInput = {
    productId: number;
    qty: number;
};

function toInt(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** 주문 품목 목록으로 본사 배송비 quote (상품가·delivery_type DB 조회) */
export async function quoteOrderDelivery(
    prisma: PrismaClient,
    items: OrderDeliveryItemInput[]
): Promise<
    | { ok: true; quote: DeliveryQuote; lineItems: DeliveryLineItem[] }
    | { ok: false; message: string }
> {
    const lineItems: DeliveryLineItem[] = [];

    for (const item of items) {
        if (!item?.productId || !item?.qty || item.qty <= 0) continue;

        const product = await prisma.mallRN_goods.findUnique({
            where: { uid: item.productId },
            select: {
                uid: true,
                price: true,
                delivery_type: true,
                vendor: true,
            },
        });

        if (!product) continue;

        lineItems.push({
            productId: product.uid,
            unitPrice: toInt(product.price, 0),
            qty: toInt(item.qty, 0),
            deliveryType: toInt(product.delivery_type, 1),
            // 1차: 본사 배송만 — shop-next 주문 goods 는 vendor_delivery='' 고정
            vendorDelivery: "",
        });
    }

    if (!lineItems.length) {
        return { ok: false, message: "배송비를 계산할 상품이 없습니다." };
    }

    const config = await loadShopDeliveryConfig(prisma);
    const quote = calculateHqDeliveryFee(lineItems, config);

    return { ok: true, quote, lineItems };
}
