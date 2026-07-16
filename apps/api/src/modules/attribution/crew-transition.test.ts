import { describe, it, expect, beforeEach } from "vitest";
import { getTestPrisma, resetZpzpTables } from "../../../test/setup";
import { ensureAttribution, confirmCrew, revokeCrew } from "./attribution.service";

const prisma = getTestPrisma();
const T1 = new Date("2026-07-10T00:00:00Z");
const T2 = new Date("2026-07-20T00:00:00Z");
const T3 = new Date("2026-07-25T00:00:00Z");

async function seededMember(memberUid: number) {
  await prisma.zpzp_linker.create({
    data: { member_uid: 1000 + memberUid, shop_slug: `s${memberUid}`, shop_name: "s", status: "active" },
  });
  await ensureAttribution(prisma, memberUid, `s${memberUid}`);
}

describe("crew transitions (audit-immutable)", () => {
  beforeEach(() => resetZpzpTables(prisma));

  it("prospect -> confirmed stamps crew_confirmed_at", async () => {
    await seededMember(5001);
    expect(await confirmCrew(prisma, 5001, T1)).toBe("confirmed");
    const r = await prisma.zpzp_referral_attribution.findUnique({ where: { member_uid: 5001 } });
    expect(r?.crew_status).toBe("confirmed");
    expect(r?.crew_confirmed_at?.toISOString()).toBe(T1.toISOString());
  });

  it("confirmed -> revoked preserves crew_confirmed_at", async () => {
    await seededMember(5002);
    await confirmCrew(prisma, 5002, T1);
    expect(await revokeCrew(prisma, 5002, T2)).toBe("revoked");
    const r = await prisma.zpzp_referral_attribution.findUnique({ where: { member_uid: 5002 } });
    expect(r?.crew_status).toBe("revoked");
    expect(r?.crew_confirmed_at?.toISOString()).toBe(T1.toISOString()); // 보존, NULL 금지
    expect(r?.crew_revoked_at?.toISOString()).toBe(T2.toISOString());
  });

  it("revoked -> confirmed re-recognition updates confirmed_at, keeps revoked_at history", async () => {
    await seededMember(5003);
    await confirmCrew(prisma, 5003, T1);
    await revokeCrew(prisma, 5003, T2);
    expect(await confirmCrew(prisma, 5003, T3)).toBe("confirmed");
    const r = await prisma.zpzp_referral_attribution.findUnique({ where: { member_uid: 5003 } });
    expect(r?.crew_status).toBe("confirmed");
    expect(r?.crew_confirmed_at?.toISOString()).toBe(T3.toISOString()); // 최신 확정으로 갱신
    expect(r?.crew_revoked_at?.toISOString()).toBe(T2.toISOString()); // 이력 보존
  });

  it("noop for organic member (no attribution row)", async () => {
    expect(await confirmCrew(prisma, 9999, T1)).toBe("noop");
    expect(await revokeCrew(prisma, 9999, T1)).toBe("noop");
  });
});
