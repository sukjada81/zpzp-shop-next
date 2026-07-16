import { describe, it, expect, beforeEach } from "vitest";
import { getTestPrisma, resetZpzpTables } from "./setup";

const prisma = getTestPrisma();

describe("zpzp attribution schema", () => {
  beforeEach(() => resetZpzpTables(prisma));

  it("enforces UNIQUE(member_uid) on attribution", async () => {
    await prisma.zpzp_linker.create({
      data: { member_uid: 1001, shop_slug: "shopA", shop_name: "A", status: "active" },
    });
    const linker = await prisma.zpzp_linker.findUnique({ where: { shop_slug: "shopA" } });
    await prisma.zpzp_referral_attribution.create({
      data: { member_uid: 5001, linker_id: linker!.uid, landing_slug: "shopA" },
    });
    await expect(
      prisma.zpzp_referral_attribution.create({
        data: { member_uid: 5001, linker_id: linker!.uid, landing_slug: "shopA" },
      })
    ).rejects.toThrow();
  });

  it("defaults crew_status to prospect", async () => {
    const l = await prisma.zpzp_linker.create({
      data: { member_uid: 1002, shop_slug: "shopB", shop_name: "B", status: "active" },
    });
    const a = await prisma.zpzp_referral_attribution.create({
      data: { member_uid: 5002, linker_id: l.uid },
    });
    expect(a.crew_status).toBe("prospect");
    expect(a.crew_confirmed_at).toBeNull();
  });
});
