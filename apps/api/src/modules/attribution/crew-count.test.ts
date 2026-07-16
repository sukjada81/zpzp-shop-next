import { describe, it, expect, beforeEach } from "vitest";
import { getTestPrisma, resetZpzpTables } from "../../../test/setup";
import { ensureAttribution, confirmCrew, revokeCrew, crewCountByLinker } from "./attribution.service";

const prisma = getTestPrisma();

async function linker(slug: string, ownerUid: number) {
  const l = await prisma.zpzp_linker.create({
    data: { member_uid: ownerUid, shop_slug: slug, shop_name: slug, status: "active" },
  });
  return l.uid;
}

describe("crewCountByLinker (cutoff)", () => {
  beforeEach(() => resetZpzpTables(prisma));

  it("counts only confirmed before cutoff; excludes prospect/revoked/after-cutoff", async () => {
    const A = await linker("A", 1001);
    // confirmed 7/31 23:59 (포함)
    await ensureAttribution(prisma, 5001, "A");
    await confirmCrew(prisma, 5001, new Date("2026-07-31T23:59:00Z"));
    // confirmed 8/01 00:01 (cutoff 이후 → 제외)
    await ensureAttribution(prisma, 5002, "A");
    await confirmCrew(prisma, 5002, new Date("2026-08-01T00:01:00Z"));
    // prospect (제외)
    await ensureAttribution(prisma, 5003, "A");
    // revoked (제외)
    await ensureAttribution(prisma, 5004, "A");
    await confirmCrew(prisma, 5004, new Date("2026-07-10T00:00:00Z"));
    await revokeCrew(prisma, 5004, new Date("2026-07-15T00:00:00Z"));

    const cutoff = new Date("2026-08-01T00:00:00Z");
    const rows = await crewCountByLinker(prisma, cutoff);
    expect(rows).toEqual([{ linkerId: A, crewCount: 1 }]);
  });

  it("re-recognized member counts under new confirmed_at", async () => {
    const A = await linker("A", 1001);
    await ensureAttribution(prisma, 5001, "A");
    await confirmCrew(prisma, 5001, new Date("2026-06-10T00:00:00Z"));
    await revokeCrew(prisma, 5001, new Date("2026-06-20T00:00:00Z"));
    await confirmCrew(prisma, 5001, new Date("2026-07-25T00:00:00Z")); // 재인정
    const rows = await crewCountByLinker(prisma, new Date("2026-08-01T00:00:00Z"));
    expect(rows).toEqual([{ linkerId: A, crewCount: 1 }]);
  });
});
