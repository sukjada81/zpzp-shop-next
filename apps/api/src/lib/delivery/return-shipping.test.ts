import { describe, expect, it } from "vitest";
import type { HqDeliveryGoodsInput, HqShopDeliveryConfig } from "./hq-delivery.js";
import {
    computePolicyOneWay,
    computeReturnShipping,
    formatClaimReason,
    parseClaimCause,
    refundAfterShipping,
} from "./return-shipping.js";

const SHOP: HqShopDeliveryConfig = {
    deliveryType: "P",
    freeThreshold: 10000,
    feeBelow: 3000,
    imAreas1Used: 1,
    imAreas1Price: 5000,
    imAreas2Used: 1,
    imAreas2Price: 3000,
};

const NONE = { jeju: false, island: false, regionExtra: 0 };
const JEJU = { jeju: true, island: false, regionExtra: 0 };

function line(
    over: Partial<HqDeliveryGoodsInput> & Pick<HqDeliveryGoodsInput, "productId" | "deliveryType">
): HqDeliveryGoodsInput {
    return {
        qty: 1,
        hasOption: false,
        price: 10000,
        deliveryPrice: 0,
        deliveryTypeQty: 1,
        imAreas1Used: 0,
        imAreas1Price: 0,
        imAreas2Used: 0,
        imAreas2Price: 0,
        ...over,
    };
}

describe("parseClaimCause", () => {
    it("[변심]/[하자] 태그를 읽는다", () => {
        expect(parseClaimCause("[변심] 반품 편도3000 차감6000")).toBe("change_of_mind");
        expect(parseClaimCause("[하자] 교환")).toBe("defect");
        expect(parseClaimCause("단순 변심")).toBe("change_of_mind");
        expect(parseClaimCause("오배송")).toBe("defect");
        expect(parseClaimCause("반품 요청")).toBe("unknown");
    });
});

describe("computePolicyOneWay", () => {
    it("type1 조건부도 설정 편도를 쓴다", () => {
        expect(computePolicyOneWay(SHOP, [line({ productId: 1, deliveryType: 1, price: 20000 })], NONE)).toBe(
            3000
        );
    });

    it("type2 무료도 설정 편도", () => {
        expect(computePolicyOneWay(SHOP, [line({ productId: 2, deliveryType: 2 })], NONE)).toBe(3000);
    });

    it("제주 type1 은 편도+제주", () => {
        expect(computePolicyOneWay(SHOP, [line({ productId: 1, deliveryType: 1 })], JEJU)).toBe(8000);
    });

    it("type4 고정+상품 제주", () => {
        expect(
            computePolicyOneWay(
                SHOP,
                [
                    line({
                        productId: 7,
                        deliveryType: 4,
                        deliveryPrice: 3500,
                        imAreas1Used: 1,
                        imAreas1Price: 4000,
                    }),
                ],
                JEJU
            )
        ).toBe(7500);
    });

    it("type5 3개당 3000, 수량 4 → 6000", () => {
        expect(
            computePolicyOneWay(
                SHOP,
                [line({ productId: 10, deliveryType: 5, deliveryPrice: 3000, deliveryTypeQty: 3, qty: 4 })],
                NONE
            )
        ).toBe(6000);
    });
});

describe("computeReturnShipping — 순서도 케이스", () => {
    const type1 = [line({ productId: 1, deliveryType: 1, price: 10000 })];

    it("하자 반품은 0원", () => {
        const q = computeReturnShipping({
            cause: "defect",
            kind: "return",
            shop: SHOP,
            returning: type1,
            remaining: [],
            extras: NONE,
            paidDelivery: 0,
        });
        expect(q.delivery2).toBe(0);
        expect(q.allowed).toBe(true);
    });

    it("변심 전체반품 무료주문은 왕복 6000", () => {
        const q = computeReturnShipping({
            cause: "change_of_mind",
            kind: "return",
            shop: SHOP,
            returning: type1,
            remaining: [],
            extras: NONE,
            paidDelivery: 0,
        });
        expect(q.oneWay).toBe(3000);
        expect(q.delivery2).toBe(6000);
        expect(refundAfterShipping({ goodsRefund: 10000, includePaidDelivery: false, paidDelivery: 0, delivery2: 6000 })).toEqual(
            { netRefund: 4000, depositDue: 0 }
        );
    });

    it("변심 전체반품 유료초도 3000 → 환불 상품+초도-왕복", () => {
        const q = computeReturnShipping({
            cause: "change_of_mind",
            kind: "return",
            shop: SHOP,
            returning: [line({ productId: 1, deliveryType: 1, price: 8000 })],
            remaining: [],
            extras: NONE,
            paidDelivery: 3000,
        });
        expect(q.delivery2).toBe(6000);
        expect(
            refundAfterShipping({
                goodsRefund: 8000,
                includePaidDelivery: true,
                paidDelivery: 3000,
                delivery2: q.delivery2,
            })
        ).toEqual({ netRefund: 5000, depositDue: 0 });
    });

    it("착불 변심 전체반품은 회수 편도만", () => {
        const q = computeReturnShipping({
            cause: "change_of_mind",
            kind: "return",
            shop: SHOP,
            returning: [line({ productId: 4, deliveryType: 3, price: 1210 })],
            remaining: [],
            extras: NONE,
            paidDelivery: 0,
        });
        expect(q.allCod).toBe(true);
        expect(q.delivery2).toBe(3000);
    });

    it("변심 부분반품: 남은 합이 무료기준 미만이면 초도+회수", () => {
        const returning = [line({ productId: 2, deliveryType: 1, price: 5000 })];
        const remaining = [line({ productId: 1, deliveryType: 1, price: 7000 })];
        const q = computeReturnShipping({
            cause: "change_of_mind",
            kind: "return",
            shop: SHOP,
            returning,
            remaining,
            extras: NONE,
            paidDelivery: 0,
        });
        expect(q.emergingOutbound).toBe(3000);
        expect(q.delivery2).toBe(6000);
        expect(
            refundAfterShipping({
                goodsRefund: 5000,
                includePaidDelivery: false,
                paidDelivery: 0,
                delivery2: 6000,
            })
        ).toEqual({ netRefund: 0, depositDue: 1000 });
    });

    it("변심 교환 1회는 왕복 선결제", () => {
        const q = computeReturnShipping({
            cause: "change_of_mind",
            kind: "exchange",
            shop: SHOP,
            returning: type1,
            remaining: type1,
            extras: NONE,
            paidDelivery: 0,
            changeOfMindExchangeCount: 0,
        });
        expect(q.allowed).toBe(true);
        expect(q.prepaid).toBe(6000);
    });

    it("변심 교환 2회는 거절", () => {
        const q = computeReturnShipping({
            cause: "change_of_mind",
            kind: "exchange",
            shop: SHOP,
            returning: type1,
            remaining: type1,
            extras: NONE,
            paidDelivery: 0,
            changeOfMindExchangeCount: 1,
        });
        expect(q.allowed).toBe(false);
    });

    it("하자 교환은 0원·횟수 무제한", () => {
        const q = computeReturnShipping({
            cause: "defect",
            kind: "exchange",
            shop: SHOP,
            returning: type1,
            remaining: type1,
            extras: NONE,
            paidDelivery: 0,
            changeOfMindExchangeCount: 3,
        });
        expect(q.allowed).toBe(true);
        expect(q.prepaid).toBe(0);
    });
});

describe("formatClaimReason", () => {
    it("100자 안에 태그를 남긴다", () => {
        const text = formatClaimReason("change_of_mind", "return", { oneWay: 3000, buyerCharge: 6000, prepaid: 0 });
        expect(text.startsWith("[변심]")).toBe(true);
        expect(parseClaimCause(text)).toBe("change_of_mind");
        expect(text.length).toBeLessThanOrEqual(100);
    });
});
