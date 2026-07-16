// apps/api/src/modules/attribution/attribution.service.ts
import type { PrismaClient } from "@prisma/client";

export type EnsureResult = "created" | "exists" | "organic";

/**
 * 멱등 first-touch 귀속.
 * - refSlug 없음/비활성 링커 → organic(no-op)
 * - 귀속행 이미 있음 → exists(no-op, linker_id 불변)
 * - 없고 active 링커 → prospect INSERT
 * UNIQUE(member_uid) 위에서 경합 시 exists로 수렴.
 */
export async function ensureAttribution(
  prisma: PrismaClient,
  memberUid: number,
  refSlug: string | null
): Promise<EnsureResult> {
  if (!memberUid || !refSlug) return "organic";

  const existing = await prisma.zpzp_referral_attribution.findUnique({
    where: { member_uid: memberUid },
    select: { uid: true },
  });
  if (existing) return "exists";

  const linker = await prisma.zpzp_linker.findFirst({
    where: { shop_slug: refSlug, status: "active" },
    select: { uid: true },
  });
  if (!linker) return "organic";

  try {
    await prisma.zpzp_referral_attribution.create({
      data: {
        member_uid: memberUid,
        linker_id: linker.uid,
        landing_slug: refSlug,
        source: "subdomain",
        crew_status: "prospect",
      },
    });
    return "created";
  } catch (e: any) {
    if (e?.code === "P2002") return "exists"; // 동시 호출 경합 → 멱등 수렴
    throw e;
  }
}

export type ConfirmResult = "confirmed" | "noop";
export type RevokeResult = "revoked" | "noop";

/** 첫 확정/재인정: crew_status=confirmed, crew_confirmed_at 갱신. revoked_at은 보존. */
export async function confirmCrew(
  prisma: PrismaClient,
  memberUid: number,
  confirmedAt: Date
): Promise<ConfirmResult> {
  const res = await prisma.zpzp_referral_attribution.updateMany({
    where: { member_uid: memberUid },
    data: { crew_status: "confirmed", crew_confirmed_at: confirmedAt },
  });
  return res.count > 0 ? "confirmed" : "noop";
}

/** void: crew_status=revoked, crew_revoked_at 스탬프. crew_confirmed_at은 보존(NULL 금지). */
export async function revokeCrew(
  prisma: PrismaClient,
  memberUid: number,
  revokedAt: Date
): Promise<RevokeResult> {
  const res = await prisma.zpzp_referral_attribution.updateMany({
    where: { member_uid: memberUid, crew_status: "confirmed" },
    data: { crew_status: "revoked", crew_revoked_at: revokedAt },
  });
  return res.count > 0 ? "revoked" : "noop";
}

export interface CrewCountRow {
  linkerId: number;
  crewCount: number;
}

/**
 * 등급 배치용 정규 카운트. cutoff = 당월 1일 00:00:00 (= 전월 말일 24시).
 * member_uid UNIQUE라 행 수 = DISTINCT 회원 수.
 */
export async function crewCountByLinker(
  prisma: PrismaClient,
  cutoff: Date
): Promise<CrewCountRow[]> {
  const grouped = await prisma.zpzp_referral_attribution.groupBy({
    by: ["linker_id"],
    where: { crew_status: "confirmed", crew_confirmed_at: { lt: cutoff } },
    _count: { member_uid: true },
    orderBy: { linker_id: "asc" },
  });
  return grouped.map((g) => ({ linkerId: g.linker_id, crewCount: g._count.member_uid }));
}
