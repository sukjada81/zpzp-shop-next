/**
 * 부분취소 환불 차감 단위 테스트 (DB 불필요).
 */
import { describe, it, expect } from "vitest";
import {
    emergingDeliveryOnCancel,
    refundAmountAfterDeliveryAdjust,
} from "./cancel-refund-adjust.js";

describe("cancel-refund-adjust — 무료→배송비 발생 시 환불 차감", () => {
    it("3만 이상 무료 → 하나 취소 후 배송 3000 발생이면 환불에서 3000 차감", () => {
        const emerging = emergingDeliveryOnCancel({
            deliveryBefore: 0,
            deliveryAfter: 3000,
        });
        expect(emerging).toBe(3000);
        expect(
            refundAmountAfterDeliveryAdjust({ lineAmount: 17800, emergingDelivery: emerging })
        ).toBe(14800);
    });

    it("이미 배송비가 있으면 추가 발생 없음 → 상품액 전액 환불", () => {
        const emerging = emergingDeliveryOnCancel({
            deliveryBefore: 3000,
            deliveryAfter: 3000,
        });
        expect(emerging).toBe(0);
        expect(
            refundAmountAfterDeliveryAdjust({ lineAmount: 12800, emergingDelivery: emerging })
        ).toBe(12800);
    });

    it("배송비가 줄면(발생분 음수) 환불 증액하지 않음", () => {
        expect(
            emergingDeliveryOnCancel({ deliveryBefore: 3000, deliveryAfter: 0 })
        ).toBe(0);
    });
});
