/**
 * 본사 배송비 1차 (shop-php order_post.php: vendor_delivery='' + type=1 + P)
 * 원복: 이 파일 + delivery.routes + order/prepare 연동만 제거하면 된다.
 */
import type { PrismaClient } from "@prisma/client";

function toInt(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** 주문 품목 기준 본사 배송비. 입점사/type3~5/도서산간 제외. */
export async function calcHqDeliveryTotal(
    prisma: PrismaClient,
    items: Array<{ productId: number; qty: number }>
): Promise<number> {
    const conf = await prisma.mallRN_configuration.findUnique({
        where: { uid: 1 },
        select: {
            delivery_type: true,
            delivery_p_price1: true,
            delivery_p_price2: true,
        },
    });

    const deliveryType = String(conf?.delivery_type ?? "P").trim().toUpperCase();
    if (deliveryType === "F" || deliveryType === "D") return 0;

    const freeThreshold = toInt(conf?.delivery_p_price1, 0);
    const feeBelow = toInt(conf?.delivery_p_price2, 0);

    let conditionalSubtotal = 0;
    let hasFreeGoods = false;

    for (const item of items) {
        if (!item?.productId || !item?.qty || item.qty <= 0) continue;
        const product = await prisma.mallRN_goods.findUnique({
            where: { uid: item.productId },
            select: { price: true, delivery_type: true },
        });
        if (!product) continue;

        const goodsType = toInt(product.delivery_type, 1);
        if (goodsType === 2) {
            hasFreeGoods = true;
            continue;
        }
        if (goodsType === 1) {
            conditionalSubtotal += toInt(product.price, 0) * toInt(item.qty, 0);
        }
    }

    if (
        conditionalSubtotal > 0 &&
        !hasFreeGoods &&
        deliveryType === "P" &&
        conditionalSubtotal < freeThreshold
    ) {
        return Math.max(0, feeBelow);
    }
    return 0;
}
