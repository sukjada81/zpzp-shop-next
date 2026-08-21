/**
 * 본사 배송비 type1~5 회귀 테스트 (DB 불필요).
 * 기준: shop-php php/order_post_toss.php vendor_delivery='' .
 */
import { describe, it, expect } from "vitest";
import {
    computeHqConditionalDelivery,
    computeHqDelivery,
    emptyImAreasResolver,
    type HqDeliveryGoodsInput,
    type HqShopDeliveryConfig,
} from "./hq-delivery.js";

const HQ: HqShopDeliveryConfig = {
    deliveryType: "P",
    freeThreshold: 30000,
    feeBelow: 3000,
    imAreas1Used: 0,
    imAreas1Price: 0,
    imAreas2Used: 0,
    imAreas2Price: 0,
};

function line(over: Partial<HqDeliveryGoodsInput> & Pick<HqDeliveryGoodsInput, "productId" | "deliveryType">): HqDeliveryGoodsInput {
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

describe("computeHqConditionalDelivery — type1 조건부", () => {
    it("기준 미만 3000 / 이상 0", () => {
        expect(
            computeHqConditionalDelivery(
                { deliveryType: "P", freeThreshold: 30000, feeBelow: 3000 },
                [{ goodsDeliveryType: 1, lineSubtotal: 2500 }]
            )
        ).toBe(3000);
        expect(
            computeHqConditionalDelivery(
                { deliveryType: "P", freeThreshold: 30000, feeBelow: 3000 },
                [{ goodsDeliveryType: 1, lineSubtotal: 30000 }]
            )
        ).toBe(0);
    });
});

describe("computeHqDelivery — type1~5 본사 미러", () => {
    it("type1: 상품 delivery_price 무시, 조건부만", () => {
        const r = computeHqDelivery(
            HQ,
            [line({ productId: 1, deliveryType: 1, price: 5000, deliveryPrice: 4000, qty: 2 })],
            {},
            emptyImAreasResolver()
        );
        expect(r.total).toBe(3000);
        expect(r.lines[0]?.deliveryPrice).toBe(0);
    });

    it("type2: 무료배송이면 조건부 0", () => {
        const r = computeHqDelivery(
            HQ,
            [
                line({ productId: 1, deliveryType: 1, price: 5000, qty: 1 }),
                line({ productId: 2, deliveryType: 2, price: 1000, qty: 1 }),
            ],
            {},
            emptyImAreasResolver()
        );
        expect(r.total).toBe(0);
    });

    it("type3: 착불은 선불 0", () => {
        const r = computeHqDelivery(
            HQ,
            [line({ productId: 1, deliveryType: 3, price: 5000, deliveryPrice: 9999 })],
            {},
            emptyImAreasResolver()
        );
        expect(r.total).toBe(0);
    });

    it("type4: 동일 상품 1회만 부과", () => {
        const r = computeHqDelivery(
            HQ,
            [
                line({ productId: 10, deliveryType: 4, deliveryPrice: 2500, price: 1000, qty: 1 }),
                line({ productId: 10, deliveryType: 4, deliveryPrice: 2500, price: 1000, qty: 1 }),
            ],
            {},
            emptyImAreasResolver()
        );
        expect(r.total).toBe(2500);
        expect(r.lines[0]?.deliveryPrice).toBe(2500);
        expect(r.lines[1]?.deliveryPrice).toBe(0);
    });

    it("type5: ceil(qty/typeQty) * delivery_price", () => {
        const r = computeHqDelivery(
            HQ,
            [
                line({
                    productId: 20,
                    deliveryType: 5,
                    deliveryPrice: 1000,
                    deliveryTypeQty: 2,
                    qty: 5,
                    price: 500,
                }),
            ],
            {},
            emptyImAreasResolver()
        );
        // ceil(5/2)=3 → 3000
        expect(r.total).toBe(3000);
    });

    it("type5 옵션: 동일 g_uid 수량 합산 1회", () => {
        const r = computeHqDelivery(
            HQ,
            [
                line({
                    productId: 30,
                    deliveryType: 5,
                    deliveryPrice: 1000,
                    deliveryTypeQty: 1,
                    qty: 2,
                    hasOption: true,
                    price: 500,
                }),
                line({
                    productId: 30,
                    deliveryType: 5,
                    deliveryPrice: 1000,
                    deliveryTypeQty: 1,
                    qty: 3,
                    hasOption: true,
                    price: 500,
                }),
            ],
            {},
            emptyImAreasResolver()
        );
        expect(r.total).toBe(5000);
    });

    it("type1 + type4 합산", () => {
        const r = computeHqDelivery(
            HQ,
            [
                line({ productId: 1, deliveryType: 1, price: 10000, qty: 1 }),
                line({ productId: 2, deliveryType: 4, deliveryPrice: 2000, price: 1000, qty: 1 }),
            ],
            {},
            emptyImAreasResolver()
        );
        // 조건부 3000 + 개별 2000
        expect(r.total).toBe(5000);
    });

    it("제주 추가: type4 상품 im_areas1", () => {
        const r = computeHqDelivery(
            HQ,
            [
                line({
                    productId: 40,
                    deliveryType: 4,
                    deliveryPrice: 1000,
                    imAreas1Used: 1,
                    imAreas1Price: 3000,
                    price: 1000,
                }),
            ],
            { address1: "제주특별자치도 제주시", postcode: "63000" },
            emptyImAreasResolver()
        );
        expect(r.total).toBe(4000);
        expect(r.lines[0]?.deliveryAddPrice).toBe(3000);
    });

    it("type1 본사 도서산간: shop 설정 + regionExtra", () => {
        const r = computeHqDelivery(
            {
                ...HQ,
                imAreas1Used: 1,
                imAreas1Price: 5000,
            },
            [line({ productId: 1, deliveryType: 1, price: 10000, qty: 1 })],
            { address1: "제주특별자치도 서귀포시", postcode: "63500" },
            {
                isIslandExtra: () => false,
                regionExtra: () => 2000,
            }
        );
        // 조건부 3000 + 제주 5000 + 지역 2000
        expect(r.total).toBe(10000);
    });

    it("전부 type3(착불)이면 본사 도서산간 블록 스킵", () => {
        const r = computeHqDelivery(
            {
                ...HQ,
                imAreas1Used: 1,
                imAreas1Price: 5000,
            },
            [line({ productId: 1, deliveryType: 3, price: 10000, qty: 1 })],
            { address1: "제주특별자치도 제주시", postcode: "63000" },
            {
                isIslandExtra: () => true,
                regionExtra: () => 9999,
            }
        );
        // type3 자체 상품 도서산간은 적용됨 (goods im 0이면 0)
        expect(r.total).toBe(0);
    });
});
