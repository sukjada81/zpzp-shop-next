// apps/api/src/modules/public/coupon.service.test.ts
// 쿠폰 할인 산식·과할인 클램프 단위 테스트(DB 불필요). 스펙 2026-07-27 §5, §10.

import { describe, it, expect } from "vitest";
import {
    clampCouponRows,
    deriveMemberCouponStatus,
    evaluateCouponDiscount,
    formatCouponDiscountLabel,
    memberCouponStatusLabel,
    pickRepresentativeCoupon,
    type CouponManagerRow,
    type CouponRow,
} from "./coupon.service";

const trunc = (v: number) => Math.trunc(v);

function def(over: Partial<CouponManagerRow> = {}): CouponManagerRow {
    return {
        uid: 1,
        name: "테스트 쿠폰",
        type: 0,
        discount: 3000,
        discount_type: "W",
        discount_limit: 0,
        use_type: 1,
        use_s_date: null,
        use_e_date: null,
        use_limit: 0,
        ...over,
    };
}

function row(over: Partial<CouponRow> = {}): CouponRow {
    return { couponUid: 1, cUid: 1, kind: "normal", amount: 3000, sortOrder: 0, ...over };
}

describe("evaluateCouponDiscount — shop-php getCouponPrice 미러", () => {
    it("정액(W) 쿠폰은 액면 그대로", () => {
        expect(evaluateCouponDiscount(def(), 20000, trunc).discount).toBe(3000);
    });

    it("웰컴머니: 최소주문 10,000원 미만이면 0 + 사용자 안내 사유", () => {
        const welcome = def({ discount: 3000, use_limit: 10000 });
        expect(evaluateCouponDiscount(welcome, 9999, trunc).discount).toBe(0);
        expect(evaluateCouponDiscount(welcome, 9999, trunc).reason).toContain("10,000원 이상");
        expect(evaluateCouponDiscount(welcome, 10000, trunc).discount).toBe(3000);
    });

    it("정률(P) 쿠폰은 할인 전 상품합계 기준으로 계산", () => {
        const p = def({ discount_type: "P", discount: 10 });
        expect(evaluateCouponDiscount(p, 20000, trunc).discount).toBe(2000);
    });

    it("정률 쿠폰의 discount_limit 상한 적용", () => {
        const p = def({ discount_type: "P", discount: 50, discount_limit: 5000 });
        expect(evaluateCouponDiscount(p, 20000, trunc).discount).toBe(5000);
    });

    it("use_type=0 기간형 쿠폰은 유효기간 밖이면 0", () => {
        const past = def({
            use_type: 0,
            use_s_date: new Date("2020-01-01"),
            use_e_date: new Date("2020-12-31"),
        });
        expect(evaluateCouponDiscount(past, 20000, trunc).discount).toBe(0);
        expect(evaluateCouponDiscount(past, 20000, trunc).reason).toBe("기간 만료");
    });

    it("상품할인쿠폰(type=4)은 최소주문 판정 대상이 아님", () => {
        const g = def({ type: 4, use_limit: 999999 });
        expect(evaluateCouponDiscount(g, 20000, trunc).discount).toBe(3000);
    });
});

describe("스택 합산 — 기획서 §7 검증 예시", () => {
    it("20,000 - 3,000(일반) - 3,000(웰컴) = 14,000", () => {
        const subtotal = 20000;
        const normal = evaluateCouponDiscount(def({ discount: 3000 }), subtotal, trunc).discount;
        const welcome = evaluateCouponDiscount(
            def({ discount: 3000, use_limit: 10000 }),
            subtotal,
            trunc
        ).discount;

        const rows = [
            row({ couponUid: 101, kind: "normal", amount: normal, sortOrder: 0 }),
            row({ couponUid: 102, kind: "welcome", amount: welcome, sortOrder: 1 }),
        ];
        const discountTotal = clampCouponRows(rows, subtotal);

        expect(discountTotal).toBe(6000);
        expect(subtotal - discountTotal).toBe(14000);
        // 루키 5% 수수료 = 700원
        expect(Math.round((subtotal - discountTotal) * 0.05)).toBe(700);
    });

    it("기록 순서는 일반(0) → 웰컴(1)", () => {
        const rows = [
            row({ couponUid: 102, kind: "welcome", sortOrder: 1 }),
            row({ couponUid: 101, kind: "normal", sortOrder: 0 }),
        ];
        rows.sort((a, b) => a.sortOrder - b.sortOrder);
        expect(rows.map((r) => r.kind)).toEqual(["normal", "welcome"]);
    });
});

describe("clampCouponRows — 과할인 방어", () => {
    it("할인 합계가 상품합계를 넘으면 상품합계까지만", () => {
        const rows = [
            row({ couponUid: 101, kind: "normal", amount: 8000, sortOrder: 0 }),
            row({ couponUid: 102, kind: "welcome", amount: 5000, sortOrder: 1 }),
        ];
        expect(clampCouponRows(rows, 10000)).toBe(10000);
        // 초과분은 뒤(웰컴)에서 깎인다
        expect(rows[0].amount).toBe(8000);
        expect(rows[1].amount).toBe(2000);
    });

    it("초과가 없으면 그대로", () => {
        const rows = [row({ amount: 3000 })];
        expect(clampCouponRows(rows, 20000)).toBe(3000);
        expect(rows[0].amount).toBe(3000);
    });

    it("한 장으로 전액을 넘겨도 음수가 되지 않음", () => {
        const rows = [row({ amount: 50000 })];
        expect(clampCouponRows(rows, 10000)).toBe(10000);
        expect(rows[0].amount).toBe(10000);
    });
});

describe("pickRepresentativeCoupon — order_info.coupon_uid 하위호환", () => {
    it("일반 쿠폰이 대표", () => {
        const rows = [
            row({ couponUid: 101, kind: "normal", sortOrder: 0 }),
            row({ couponUid: 102, kind: "welcome", sortOrder: 1 }),
        ];
        expect(pickRepresentativeCoupon(rows)).toBe(101);
    });

    it("웰컴 단독이면 웰컴이 대표", () => {
        expect(pickRepresentativeCoupon([row({ couponUid: 102, kind: "welcome" })])).toBe(102);
    });

    it("쿠폰 미사용이면 0", () => {
        expect(pickRepresentativeCoupon([])).toBe(0);
    });
});

describe("deriveMemberCouponStatus — my_coupon.php 미러", () => {
    const future = new Date("2099-01-01T00:00:00Z");
    const past = new Date("2020-01-01T00:00:00Z");

    it("미사용·유효기간 남음 → available", () => {
        expect(deriveMemberCouponStatus(0, future)).toBe("available");
        expect(memberCouponStatusLabel("available")).toBe("사용가능");
    });

    it("사용됨 → used", () => {
        expect(deriveMemberCouponStatus(1, future)).toBe("used");
        expect(memberCouponStatusLabel("used")).toBe("사용완료");
    });

    it("만료 status 또는 e_date 지남 → expired", () => {
        expect(deriveMemberCouponStatus(2, future)).toBe("expired");
        expect(deriveMemberCouponStatus(0, past)).toBe("expired");
        expect(memberCouponStatusLabel("expired")).toBe("기간만료");
    });
});

describe("formatCouponDiscountLabel", () => {
    it("정액·정률 라벨", () => {
        expect(formatCouponDiscountLabel(def())).toBe("3,000원");
        expect(formatCouponDiscountLabel(def({ discount_type: "P", discount: 10 }))).toBe("10%");
    });
});
