import { describe, it, expect, beforeEach } from "vitest";
import { getTestPrisma, resetZpzpTables } from "../../../test/setup";
import { ensureAttribution } from "./attribution.service";

const prisma = getTestPrisma();

async function activeLinker(slug: string, memberUid: number) {
  return prisma.zpzp_linker.create({
    data: { member_uid: memberUid, shop_slug: slug, shop_name: slug, status: "active" },
  });
}

describe("ensureAttribution", () => {
  beforeEach(() => resetZpzpTables(prisma));

  it("organic when refSlug null", async () => {
    expect(await ensureAttribution(prisma, 5001, null)).toBe("organic");
    expect(await prisma.zpzp_referral_attribution.count()).toBe(0);
  });

  it("organic when slug is not an active linker", async () => {
    await prisma.zpzp_linker.create({
      data: { member_uid: 1001, shop_slug: "pend", shop_name: "p", status: "pending" },
    });
    expect(await ensureAttribution(prisma, 5001, "pend")).toBe("organic");
    expect(await ensureAttribution(prisma, 5001, "ghost")).toBe("organic");
    expect(await prisma.zpzp_referral_attribution.count()).toBe(0);
  });

  it("creates prospect attribution for active linker", async () => {
    const l = await activeLinker("shopA", 1001);
    expect(await ensureAttribution(prisma, 5001, "shopA")).toBe("created");
    const row = await prisma.zpzp_referral_attribution.findUnique({ where: { member_uid: 5001 } });
    expect(row?.linker_id).toBe(l.uid);
    expect(row?.crew_status).toBe("prospect");
    expect(row?.landing_slug).toBe("shopA");
  });

  it("is idempotent — second call is no-op, linker unchanged (first-touch lock)", async () => {
    const a = await activeLinker("shopA", 1001);
    await activeLinker("shopB", 1002);
    expect(await ensureAttribution(prisma, 5001, "shopA")).toBe("created");
    expect(await ensureAttribution(prisma, 5001, "shopB")).toBe("exists"); // 다른 링커여도 불변
    const row = await prisma.zpzp_referral_attribution.findUnique({ where: { member_uid: 5001 } });
    expect(row?.linker_id).toBe(a.uid); // 최초 링커 유지
    expect(await prisma.zpzp_referral_attribution.count()).toBe(1);
  });
});
