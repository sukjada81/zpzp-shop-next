import { describe, expect, it } from "vitest";
import {
    canCustomerFullImmediateCancel,
    resolveOrderGoodsAggregate,
} from "./customer-order-display.js";

describe("resolveOrderGoodsAggregate / full cancel", () => {
    it("결제완료+배송중 섞이면 대표 상태는 배송중", () => {
        const agg = resolveOrderGoodsAggregate(
            [
                { status: 1, status2: 0 },
                { status: 3, status2: 0 },
            ],
            "C"
        );
        expect(agg.goodsStatus).toBe(3);
        expect(canCustomerFullImmediateCancel(
            [
                { status: 1, status2: 0 },
                { status: 3, status2: 0 },
            ],
            "C"
        )).toBe(false);
    });

    it("활성 상품이 모두 결제완료면 전체 즉시취소 가능", () => {
        expect(
            canCustomerFullImmediateCancel(
                [
                    { status: 1, status2: 0 },
                    { status: 1, status2: 0 },
                ],
                "C"
            )
        ).toBe(true);
    });

    it("배송준비중이 하나라도 있으면 고객 전체 즉시취소 불가", () => {
        expect(
            canCustomerFullImmediateCancel(
                [
                    { status: 1, status2: 0 },
                    { status: 2, status2: 0 },
                ],
                "C"
            )
        ).toBe(false);
    });
});
