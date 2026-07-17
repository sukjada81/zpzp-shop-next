import { describe, it, expect, beforeEach } from "vitest";
import { getTestPrisma, resetZpzpTables } from "./setup";
const prisma = getTestPrisma();
describe("zpzp_linker 확장", () => {
  beforeEach(() => resetZpzpTables(prisma));
  it("rejected 상태 + reject_reason 저장", async () => {
    const l = await prisma.zpzp_linker.create({
      data: { member_uid: 8001, shop_slug: "shopr", shop_name: "R", status: "rejected", reject_reason: "채널 확인 불가" },
    });
    expect(l.status).toBe("rejected");
    expect(l.reject_reason).toBe("채널 확인 불가");
  });
  it("약관 2종 시각 + approved_by", async () => {
    const now = new Date("2026-07-17T00:00:00Z");
    const l = await prisma.zpzp_linker.create({
      data: { member_uid: 8002, shop_slug: "shops", shop_name: "S", agreed_service_at: now, agreed_settlement_at: now, approved_by: "admin1" },
    });
    expect(l.agreed_service_at).not.toBeNull();
    expect(l.agreed_settlement_at).not.toBeNull();
    expect(l.approved_by).toBe("admin1");
  });
});
