import { describe, it, expect, beforeEach } from "vitest";
import { getTestPrisma, resetZpzpTables } from "../../../test/setup";
import { captureRefFromRequest } from "./capture";

const prisma = getTestPrisma();

describe("order-time capture (2nd, safety net)", () => {
  beforeEach(() => resetZpzpTables(prisma));

  it("fills attribution missed at login, idempotent with login capture", async () => {
    await prisma.zpzp_linker.create({
      data: { member_uid: 1001, shop_slug: "shopA", shop_name: "A", status: "active" },
    });
    // 로그인 캡처를 놓친 상태에서 주문 시점 캡처가 채움
    await captureRefFromRequest(prisma, 5001, { zpzp_ref: "shopA" });
    // 로그인 캡처가 뒤늦게 또 돌아도 멱등
    await captureRefFromRequest(prisma, 5001, { zpzp_ref: "shopA" });
    expect(await prisma.zpzp_referral_attribution.count()).toBe(1);
  });
});
