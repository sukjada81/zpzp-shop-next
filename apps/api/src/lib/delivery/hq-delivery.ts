/**
 * 본사 배송비 1차 (shop-php order_post.php vendor_delivery='' + delivery_type=1 + P)
 * - F/D → 0
 * - P → type=1 상품합 < delivery_p_price1 이면 delivery_p_price2 1회
 * - type=2(상품무료) 있으면 조건부 배송비 면제
 */
import type { PrismaClient } from "@prisma/client";

export type HqDeliveryConfig = {
    deliveryType: "F" | "P" | "D";
    freeThreshold: number;
    feeBelowThreshold: number;
};

function toInt(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function loadHqDeliveryConfig(prisma: PrismaClient): Promise<HqDeliveryConfig> {
    const row = await prisma.mallRN_configuration.findUnique({
        where: { uid: 1 },
        select: {
            delivery_type: true,
            delivery_p_price1: true,
            delivery_p_price2: true,
        },
    });
    const raw = String(row?.delivery_type ?? "P").trim().toUpperCase();
    const deliveryType = raw === "F" || raw === "D" || raw === "P" ? raw : "P";
    return {
        deliveryType,
        freeThreshold: toInt(row?.delivery_p_price1, 0),
        feeBelowThreshold: toInt(row?.delivery_p_price2, 0),
    };
}

/** 주문 품목 기준 본사 배송비. 입점사/type3~5/도서산간은 1차 제외. */
export async function calcHqDeliveryTotal(
    prisma: PrismaClient,
    items: Array<{ productId: number; qty: number }>
): Promise<number> {
    const config = await loadHqDeliveryConfig(prisma);
    if (config.deliveryType === "F" || config.deliveryType === "D") return 0;

    let conditionalSubtotal = 0;
    let hasFreeGoods = false;

    for (const item of items) {
        if (!item?.productId || !item?.qty || item.qty <= 0) continue;
        const product = await prisma.mallRN_goods.findUnique({
            where: { uid: item.productId },
            select: { price: true, delivery_type: true },
        });
        if (!product) continue;

        const deliveryType = toInt(product.delivery_type, 1);
        if (deliveryType === 2) {
            hasFreeGoods = true;
            continue;
        }
        if (deliveryType === 1) {
            conditionalSubtotal += toInt(product.price, 0) * toInt(item.qty, 0);
        }
    }

    if (
        conditionalSubtotal > 0 &&
        !hasFreeGoods &&
        config.deliveryType === "P" &&
        conditionalSubtotal < config.freeThreshold
    ) {
        return Math.max(0, config.feeBelowThreshold);
    }
    return 0;
}
