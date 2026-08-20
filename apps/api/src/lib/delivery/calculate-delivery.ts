/**
 * 배송비 계산 — shop-php order_post.php 1차 포팅
 *
 * 포함 (phase 1):
 *   - vendor_delivery='' (본사 배송 그룹)
 *   - mallRN_goods.delivery_type=1 + mallRN_configuration.delivery_type=P 조건부 무료
 *   - delivery_type=2(상품 무료배송) → 그룹 조건부 배송비 면제(VENDOR_DELIVERY_FREE)
 *
 * 제외 (phase 2+):
 *   - 입점사 vendor_delivery 그룹
 *   - delivery_type 3(착불)·4(고정)·5(N개당)
 *   - deliveryImAreasPrice 제주·도서산간
 */
import type { ShopDeliveryConfig } from "./delivery-config.js";

export type DeliveryLineItem = {
    productId: number;
    unitPrice: number;
    qty: number;
    /** mallRN_goods.delivery_type — 1=환경설정, 2=무료, 3=착불, 4=고정, 5=N개당 */
    deliveryType: number;
    /** 1차는 본사('')만 처리. 비어 있지 않으면 0 반환(2차에서 그룹별 계산) */
    vendorDelivery?: string;
};

export type DeliveryQuote = {
    subtotal: number;
    deliveryTotal: number;
    /** P 정책 산출에 포함된 type=1 상품 합계(디버그·UI용) */
    conditionalSubtotal: number;
};

function toInt(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/**
 * 본사(vendor_delivery='') 그룹 배송비.
 * PHP: DISTINCT vendor_delivery 루프 중 $VENDOR === '' 분기.
 */
export function calculateHqDeliveryFee(
    items: DeliveryLineItem[],
    config: ShopDeliveryConfig
): DeliveryQuote {
    const hqItems = items.filter((row) => !String(row.vendorDelivery ?? "").trim());
    const subtotal = hqItems.reduce(
        (sum, row) => sum + toInt(row.unitPrice, 0) * toInt(row.qty, 0),
        0
    );

    // 전역 무료(F) 또는 착불(D) — 온라인 결제 prepare/confirm 에는 0
    if (config.deliveryType === "F" || config.deliveryType === "D") {
        return { subtotal, deliveryTotal: 0, conditionalSubtotal: 0 };
    }

    // P(조건부): type=1 상품 합이 freeThreshold 미만이면 feeBelowThreshold 1회
    let conditionalSubtotal = 0;
    let vendorDeliveryFree = false;

    for (const row of hqItems) {
        const lineType = toInt(row.deliveryType, 1);

        if (lineType === 1) {
            conditionalSubtotal += toInt(row.unitPrice, 0) * toInt(row.qty, 0);
        } else if (lineType === 2) {
            // PHP: $VENDOR_DELIVERY_FREE = 1 → 조건부 배송비 부과 블록 스킵
            vendorDeliveryFree = true;
        }
        // type 3~5: 1차에서는 per-line 배송비 0 (2차에서 확장)
    }

    let deliveryTotal = 0;
    if (
        conditionalSubtotal > 0 &&
        !vendorDeliveryFree &&
        config.deliveryType === "P" &&
        conditionalSubtotal < config.freeThreshold
    ) {
        deliveryTotal = Math.max(0, config.feeBelowThreshold);
    }

    return { subtotal, deliveryTotal, conditionalSubtotal };
}

/** 상품 상세·장바구니 안내 문구 */
export function formatDeliveryPolicyLabel(config: ShopDeliveryConfig): string {
    if (config.deliveryType === "F") return "무료배송";
    if (config.deliveryType === "D") return "착불배송";
    const threshold = config.freeThreshold;
    const fee = config.feeBelowThreshold;
    if (threshold > 0 && fee > 0) {
        return `${threshold.toLocaleString("ko-KR")}원 이상 무료 / 미만 ${fee.toLocaleString("ko-KR")}원`;
    }
    if (fee > 0) return `배송비 ${fee.toLocaleString("ko-KR")}원`;
    return "배송비 정책 확인";
}

/** 단일 상품(delivery_type=1) 기준 안내 — 장바구니 없이 상세만 볼 때 */
export function formatProductDeliveryHint(
    goodsDeliveryType: number,
    config: ShopDeliveryConfig
): string {
    const type = toInt(goodsDeliveryType, 1);
    if (type === 2) return "무료배송";
    if (type === 3) return "착불배송";
    if (type === 4 || type === 5) return "배송비 별도(상품 설정)";
    return formatDeliveryPolicyLabel(config);
}
