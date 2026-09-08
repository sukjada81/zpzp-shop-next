import { describe, expect, it } from "vitest";
import {
    adminOrderKeywordGoodsFilters,
    adminOrderKeywordInfoFilters,
    digitsOnly,
} from "./admin-order-search.js";

describe("adminOrderKeywordInfoFilters", () => {
    it("주문자·수령자·주소·메모·링커샵·결제정보까지 본다", () => {
        const filters = adminOrderKeywordInfoFilters("강남");
        const fields = filters.flatMap((row) => Object.keys(row));
        expect(fields).toEqual(
            expect.arrayContaining([
                "order_num",
                "id",
                "name",
                "name2",
                "cell",
                "cell2",
                "email",
                "address1",
                "address2",
                "postcode",
                "memo",
                "message",
                "checkout_shop_slug",
                "bank_info",
                "pay_info",
                "pay_number",
                "pay_method",
            ])
        );
    });

    it("전화번호는 숫자만 남겨 하이픈 없는 값도 찾는다", () => {
        expect(digitsOnly("010-0000-9901")).toBe("01000009901");
        const filters = adminOrderKeywordInfoFilters("010-0000-9901");
        expect(filters).toEqual(
            expect.arrayContaining([
                { cell: { contains: "01000009901" } },
                { cell2: { contains: "01000009901" } },
            ])
        );
    });

    it("주문번호·아이디는 정확 일치도 추가한다", () => {
        const filters = adminOrderKeywordInfoFilters("ZTEST-CLAIM-R1");
        expect(filters).toEqual(
            expect.arrayContaining([
                { order_num: { equals: "ZTEST-CLAIM-R1" } },
                { id: { equals: "ZTEST-CLAIM-R1" } },
            ])
        );
    });
});

describe("adminOrderKeywordGoodsFilters", () => {
    it("상품명·코드·송장·옵션을 찾고 숫자는 상품번호로도 본다", () => {
        const named = adminOrderKeywordGoodsFilters("테스트상품1");
        expect(named).toEqual(
            expect.arrayContaining([
                { g_name: { contains: "테스트상품1" } },
                { g_code: { contains: "테스트상품1" } },
                { delivery_info: { contains: "테스트상품1" } },
                { option_name: { contains: "테스트상품1" } },
            ])
        );

        const numeric = adminOrderKeywordGoodsFilters("51518");
        expect(numeric).toEqual(
            expect.arrayContaining([{ g_uid: 51518 }, { uid: 51518 }])
        );
    });
});
