import { describe, it, expect, beforeEach } from "vitest";
import { getTestPrisma, resetZpzpTables } from "../../../test/setup";
import { captureRefFromRequest } from "./capture";

const prisma = getTestPrisma();

describe("captureRefFromRequest", () => {
  beforeEach(() => resetZpzpTables(prisma));

  it("creates attribution from zpzp_ref cookie", async () => {
    await prisma.zpzp_linker.create({
      data: { member_uid: 1001, shop_slug: "shopA", shop_name: "A", status: "active" },
    });
    await captureRefFromRequest(prisma, 5001, { zpzp_ref: "shopA" });
    const row = await prisma.zpzp_referral_attribution.findUnique({ where: { member_uid: 5001 } });
    expect(row?.landing_slug).toBe("shopA");
  });

  it("no-op and does not throw when cookie absent", async () => {
    await expect(captureRefFromRequest(prisma, 5001, {})).resolves.toBeUndefined();
    expect(await prisma.zpzp_referral_attribution.count()).toBe(0);
  });
});
