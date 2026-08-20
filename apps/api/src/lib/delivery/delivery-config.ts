/**
 * 본사 몰 배송 정책(mallRN_configuration) 로더
 *
 * 1차 범위: uid=1 본사 설정만 사용. 입점사 mallRN_vendor_configuration 은 2차.
 * shop-php order_post.php 가 vendor_delivery='' 일 때 $shop_config 를 쓰는 것과 동일.
 */
import type { PrismaClient } from "@prisma/client";

/** mallRN_configuration.delivery_type — F=무료, P=조건부, D=착불(온라인 결제액에는 미포함) */
export type ShopDeliveryType = "F" | "P" | "D";

export type ShopDeliveryConfig = {
    deliveryType: ShopDeliveryType;
    /** 조건부(P) 무료배송 기준 금액 — delivery_p_price1 */
    freeThreshold: number;
    /** 조건부(P) 기준 미만일 때 부과 — delivery_p_price2 */
    feeBelowThreshold: number;
};

function toInt(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function normalizeDeliveryType(value: unknown): ShopDeliveryType {
    const text = String(value ?? "P").trim().toUpperCase();
    if (text === "F" || text === "D" || text === "P") return text;
    return "P";
}

/** 본사 mallRN_configuration(uid=1) 배송 설정. 없으면 P·0원 폴백. */
export async function loadShopDeliveryConfig(
    prisma: PrismaClient
): Promise<ShopDeliveryConfig> {
    const row = await prisma.mallRN_configuration.findUnique({
        where: { uid: 1 },
        select: {
            delivery_type: true,
            delivery_p_price1: true,
            delivery_p_price2: true,
        },
    });

    return {
        deliveryType: normalizeDeliveryType(row?.delivery_type),
        freeThreshold: toInt(row?.delivery_p_price1, 0),
        feeBelowThreshold: toInt(row?.delivery_p_price2, 0),
    };
}
