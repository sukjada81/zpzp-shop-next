import { describe, expect, it } from "vitest";
import {
    canCustomerFullImmediateCancel,
    resolveCustomerOrderDisplay,
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

describe("resolveCustomerOrderDisplay footer", () => {
    it("반품완료(status8/status2=5)는 진행 중 문구 대신 완료 문구", () => {
        const display = resolveCustomerOrderDisplay({
            goodsStatus: 8,
            goodsStatus2: 5,
            payType: "C",
            payStatus: "C",
            payInfo: "TOSS|card",
        });
        expect(display.statusLabel).toBe("반품완료");
        expect(display.footerText).toBe("반품 처리가 완료되었습니다.");
    });

    it("반품 요청(status8/status2=1)은 진행 중 문구", () => {
        const display = resolveCustomerOrderDisplay({
            goodsStatus: 8,
            goodsStatus2: 1,
            payType: "C",
            payStatus: "C",
            payInfo: "TOSS|card",
        });
        expect(display.statusLabel).toBe("반품요청");
        expect(display.footerText).toBe("교환·반품 처리가 진행 중입니다.");
    });
});
