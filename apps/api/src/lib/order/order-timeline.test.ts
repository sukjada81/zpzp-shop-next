import { describe, expect, it } from "vitest";
import {
    buildOrderTimeline,
    customerActorLabel,
    toCustomerOrderTimeline,
} from "./order-timeline.js";

describe("customerActorLabel", () => {
    it("내부 역할을 고객 화면용 말로 바꾼다", () => {
        expect(customerActorLabel("member/ztest_claim_buyer")).toBe("고객 · ztest_claim_buyer");
        expect(customerActorLabel("hq/admin")).toBe("본사 · admin");
        expect(customerActorLabel("system")).toBe("시스템");
    });
});

describe("buildOrderTimeline claim events", () => {
    it("변심 반품 신청은 차감·미수를 주문 단위 로그에 남긴다", () => {
        const entries = buildOrderTimeline({
            auditRows: [
                {
                    uid: 1,
                    event_type: "claim_request",
                    order_goods_uid: 101,
                    actor_role: "member",
                    actor_nickname: "ztest_claim_buyer",
                    before_status: 4,
                    after_status: 8,
                    reason: "단순 변심",
                    meta_json: JSON.stringify({
                        kind: "return",
                        cause: "change_of_mind",
                        delivery2: 6000,
                        prepaid: 0,
                        depositDue: 1900,
                        afterStatus2: 1,
                    }),
                    created_at: new Date("2026-09-04T08:00:00Z"),
                },
            ],
            orderLogRows: [],
            tossCancelRows: [],
            tossPrepareRows: [],
        });

        expect(entries[0]?.label).toBe("교환·반품 요청");
        expect(entries[0]?.detail).toContain("변심");
        expect(entries[0]?.detail).toContain("차감 6,000원");
        expect(entries[0]?.detail).toContain("미수 1,900원");
    });

    it("고객 화면에는 내부 meta를 숨긴다", () => {
        const admin = buildOrderTimeline({
            auditRows: [
                {
                    uid: 2,
                    event_type: "claim_complete",
                    order_goods_uid: 101,
                    actor_role: "hq",
                    actor_nickname: "manager",
                    before_status: 8,
                    after_status: 8,
                    reason: "반품완료",
                    meta_json: JSON.stringify({
                        kind: "return",
                        cause: "defect",
                        tossCancel: 4100,
                        afterStatus2: 5,
                    }),
                    created_at: new Date("2026-09-04T09:00:00Z"),
                },
            ],
            orderLogRows: [],
            tossCancelRows: [],
            tossPrepareRows: [],
        });
        const customer = toCustomerOrderTimeline(admin);
        expect(customer[0]?.label).toBe("반품·교환 완료");
        expect(customer[0]?.actor).toBe("본사 · manager");
        expect(customer[0]?.meta).toBeNull();
    });
});
