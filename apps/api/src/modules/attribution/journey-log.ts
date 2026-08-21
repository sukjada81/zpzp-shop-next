/**
 * 링커 여정 이벤트 로그.
 * - visit: 링커 스토어 첫 유입(zpzp_ref 신규 스탬프)
 * - attributed: 회원 first-touch 귀속 생성
 * - order_created: 주문 생성(귀속 링커 + 결제 스토어 slug)
 *
 * 실패해도 본 흐름(로그인/주문/미들웨어)을 막지 않는다.
 */
import type { PrismaClient } from "@prisma/client";

export type LinkerJourneyEventType = "visit" | "attributed" | "order_created";

export type LogLinkerJourneyInput = {
    eventType: LinkerJourneyEventType;
    /** 방문/귀속 링커, 또는 주문 시 귀속 링커 */
    linkerId?: number | null;
    landingSlug?: string | null;
    memberUid?: number | null;
    orderNum?: string | null;
    /** 주문 결제 시점 스토어 slug (본사면 '') */
    checkoutShopSlug?: string | null;
    sessionKey?: string | null;
    meta?: Record<string, unknown> | null;
};

function toSafeSlug(value: unknown): string | null {
    const text = String(value ?? "")
        .trim()
        .toLowerCase()
        .slice(0, 64);
    return text || null;
}

function toOptionalInt(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.trunc(n);
}

/** slug → active 링커 uid. 없으면 null(이벤트는 slug만으로도 남긴다). */
export async function resolveLinkerIdBySlug(
    prisma: PrismaClient,
    slug: string | null | undefined
): Promise<number | null> {
    const shopSlug = toSafeSlug(slug);
    if (!shopSlug) return null;
    const linker = await prisma.zpzp_linker.findFirst({
        where: { shop_slug: shopSlug, status: "active" },
        select: { uid: true },
    });
    return linker?.uid ?? null;
}

export async function logLinkerJourneyEvent(
    prisma: PrismaClient,
    input: LogLinkerJourneyInput
): Promise<void> {
    try {
        const landingSlug = toSafeSlug(input.landingSlug);
        const checkoutShopSlug =
            input.checkoutShopSlug === undefined || input.checkoutShopSlug === null
                ? null
                : String(input.checkoutShopSlug).trim().toLowerCase().slice(0, 64);

        await prisma.zpzp_linker_journey_event.create({
            data: {
                event_type: input.eventType,
                linker_id: toOptionalInt(input.linkerId),
                landing_slug: landingSlug,
                member_uid: toOptionalInt(input.memberUid),
                order_num: input.orderNum ? String(input.orderNum).slice(0, 50) : null,
                checkout_shop_slug: checkoutShopSlug,
                session_key: input.sessionKey
                    ? String(input.sessionKey).trim().slice(0, 64)
                    : null,
                meta_json: input.meta ? JSON.stringify(input.meta).slice(0, 1000) : null,
            },
        });
    } catch (e) {
        console.error("LINKER_JOURNEY_LOG_FAILED", {
            eventType: input.eventType,
            err: String(e),
        });
    }
}

/** 주문 생성 직후 — 귀속 링커 + 결제 스토어를 한 줄로 남긴다. */
export async function logOrderCreatedJourney(
    prisma: PrismaClient,
    input: {
        memberUid: number | bigint;
        orderNum: string;
        checkoutShopSlug?: string | null;
    }
): Promise<void> {
    const memberUid = toOptionalInt(input.memberUid);
    if (!memberUid || !input.orderNum) return;

    try {
        const attr = await prisma.zpzp_referral_attribution.findUnique({
            where: { member_uid: memberUid },
            select: { linker_id: true, landing_slug: true },
        });
        const checkout = toSafeSlug(input.checkoutShopSlug) ?? "";
        await logLinkerJourneyEvent(prisma, {
            eventType: "order_created",
            linkerId: attr?.linker_id ?? null,
            landingSlug: attr?.landing_slug ?? (checkout || null),
            memberUid,
            orderNum: input.orderNum,
            checkoutShopSlug: checkout,
            meta: {
                attributed_linker_id: attr?.linker_id ?? null,
                attributed_landing_slug: attr?.landing_slug ?? null,
                purchase_shop_slug: checkout,
            },
        });
    } catch (e) {
        console.error("LINKER_JOURNEY_ORDER_LOG_FAILED", {
            orderNum: input.orderNum,
            err: String(e),
        });
    }
}

/** 셀러 대시보드 — 오늘 해당 스토어 유입(visit) 건수 */
export async function countTodayLinkerVisits(
    prisma: PrismaClient,
    shopSlug: string
): Promise<number> {
    const slug = toSafeSlug(shopSlug);
    if (!slug) return 0;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return prisma.zpzp_linker_journey_event.count({
        where: {
            event_type: "visit",
            landing_slug: slug,
            created_at: { gte: start },
        },
    });
}
