// apps/api/src/modules/attribution/capture.ts
import type { PrismaClient } from "@prisma/client";
import { ensureAttribution } from "./attribution.service";

/** 요청 쿠키의 zpzp_ref(slug)로 멱등 귀속. 로그인/주문 흐름을 절대 막지 않는다. */
export async function captureRefFromRequest(
  prisma: PrismaClient,
  memberUid: number,
  cookies: Record<string, string | undefined>
): Promise<void> {
  try {
    const ref = cookies["zpzp_ref"] ?? null;
    await ensureAttribution(prisma, memberUid, ref);
  } catch (e) {
    console.error("ATTRIBUTION_CAPTURE_FAILED", { memberUid, err: String(e) });
  }
}
