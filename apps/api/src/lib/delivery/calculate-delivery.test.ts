import { describe, expect, it } from "vitest";
import {
    calculateHqDeliveryFee,
    formatDeliveryPolicyLabel,
} from "./calculate-delivery.js";

const pConfig = {
    deliveryType: "P" as const,
    freeThreshold: 30_000,
    feeBelowThreshold: 3_000,
};

describe("calculateHqDeliveryFee (phase 1 — HQ P policy)", () => {
    it("3만원 미만 type=1 단일 품목 → 3,000원", () => {
        const quote = calculateHqDeliveryFee(
            [{ productId: 1, unitPrice: 12_800, qty: 1, deliveryType: 1 }],
            pConfig
        );
        expect(quote.deliveryTotal).toBe(3_000);
        expect(quote.conditionalSubtotal).toBe(12_800);
    });

    it("3만원 이상 type=1 → 무료", () => {
        const quote = calculateHqDeliveryFee(
            [{ productId: 1, unitPrice: 30_000, qty: 1, deliveryType: 1 }],
            pConfig
        );
        expect(quote.deliveryTotal).toBe(0);
    });

    it("2품목 합 3만원 이상 → 무료", () => {
        const quote = calculateHqDeliveryFee(
            [
                { productId: 1, unitPrice: 12_800, qty: 1, deliveryType: 1 },
                { productId: 2, unitPrice: 17_800, qty: 1, deliveryType: 1 },
            ],
            pConfig
        );
        expect(quote.subtotal).toBe(30_600);
        expect(quote.deliveryTotal).toBe(0);
    });

    it("type=2(상품 무료배송) 포함 시 조건부 배송비 면제", () => {
        const quote = calculateHqDeliveryFee(
            [
                { productId: 1, unitPrice: 10_000, qty: 1, deliveryType: 1 },
                { productId: 2, unitPrice: 5_000, qty: 1, deliveryType: 2 },
            ],
            pConfig
        );
        expect(quote.deliveryTotal).toBe(0);
    });

    it("전역 F → 항상 0", () => {
        const quote = calculateHqDeliveryFee(
            [{ productId: 1, unitPrice: 10_000, qty: 1, deliveryType: 1 }],
            { ...pConfig, deliveryType: "F" }
        );
        expect(quote.deliveryTotal).toBe(0);
    });
});

describe("formatDeliveryPolicyLabel", () => {
    it("P 정책 문구", () => {
        expect(formatDeliveryPolicyLabel(pConfig)).toContain("30,000");
        expect(formatDeliveryPolicyLabel(pConfig)).toContain("3,000");
    });
});
