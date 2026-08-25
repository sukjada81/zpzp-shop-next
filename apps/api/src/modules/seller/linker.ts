// apps/api/src/modules/seller/linker.ts
// 셀러 콘솔의 링커 판별 — 상품관리·정산이 같은 규칙을 쓰도록 공용화.
// 규칙: 세션 member_uid + status='active' + (tenant_id 일치 ‖ shop_slug 가 현재 tenant)
// 링커는 소속 점포가 없어 tenant_id 가 NULL 이므로(shop-php lib/linker_apply.php 방향교정)
// 실무상 shop_slug 매칭이 주 경로다.
//
// 링커 slug 콘솔 데이터 스코프:
// - 주문/매출/대시보드/회원 → linker_id (귀속 + 결제 스토어 slug)
// - 예외: 등록 가능 상품 리스트 = 본사 전체 카탈로그 − 이미 선택한 상품
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";

export type SellerLinker = {
    uid: number;
    member_uid: number;
    shop_slug: string;
    shop_name: string;
};

/** URL slug 가 링커 스토어일 때 메뉴 데이터 범위 */
export type LinkerSlugScope = {
    linkerId: number;
    shopSlug: string;
    /** 해당 linker_id 귀속 회원 */
    memberUids: number[];
    memberUidSet: Set<number>;
};

export function memberUidFromSession(req: FastifyRequest) {
    const uid = (req as FastifyRequest & { session?: { member?: { uid?: string | number } } }).session
        ?.member?.uid;
    const n = Number(uid);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

export async function getLinker(app: FastifyInstance, req: FastifyRequest): Promise<SellerLinker | null> {
    const uid = memberUidFromSession(req);
    if (!uid) return null;

    const tenantId = (req as FastifyRequest & { tenantId?: bigint }).tenantId;
    const tenantSlug = String((req as FastifyRequest & { tenantSlug?: string }).tenantSlug ?? "").trim();
    return findActiveLinkerForTenant(app, tenantId, tenantSlug, uid);
}

/** 점포(tenant)에 연결된 활성 링커 — staff/HQ도 동일 점포 귀속 기준을 쓴다. */
export async function getTenantLinker(
    app: FastifyInstance,
    tenantId: bigint | undefined,
    tenantSlug: string
): Promise<SellerLinker | null> {
    return findActiveLinkerForTenant(app, tenantId, tenantSlug);
}

/**
 * 현재 URL slug 가 링커 shop_slug 와 일치할 때만 스코프를 반환한다.
 * tenant_id 폴백을 쓰지 않는다 — 본사몰 tenant 로 해석되는 링커 slug 에서
 * 다른 링커/전체 회원·주문이 새는 것을 막기 위함.
 */
export async function resolveLinkerSlugScope(
    app: FastifyInstance,
    _tenantId: bigint | undefined,
    tenantSlug: string
): Promise<LinkerSlugScope | null> {
    const slug = String(tenantSlug ?? "").trim();
    if (!slug) return null;

    const linker = await app.prisma.zpzp_linker.findFirst({
        where: {
            status: "active",
            shop_slug: slug,
        },
        select: {
            uid: true,
            shop_slug: true,
        },
    });
    if (!linker) return null;

    const attributions = await app.prisma.zpzp_referral_attribution.findMany({
        where: { linker_id: linker.uid },
        select: { member_uid: true },
    });
    const memberUids = attributions
        .map((row) => Number(row.member_uid))
        .filter((uid) => Number.isFinite(uid) && uid > 0);

    return {
        linkerId: Number(linker.uid),
        shopSlug: String(linker.shop_slug ?? ""),
        memberUids,
        memberUidSet: new Set(memberUids),
    };
}

/**
 * 활성 링커 본인 계정 uid 집합.
 * 링커 콘솔의 「회원가입/회원」 집계에서 링커를 빼기 위해 쓴다.
 * (주문·매출 스코프에는 적용하지 않는다 — 링커가 크루로서 산 주문은 남겨야 함)
 */
export async function activeLinkerMemberUidSet(
    app: FastifyInstance,
    memberUids: number[]
): Promise<Set<number>> {
    const uids = Array.from(
        new Set(
            memberUids
                .map((uid) => Number(uid))
                .filter((uid) => Number.isFinite(uid) && uid > 0)
        )
    );
    if (!uids.length) return new Set();

    const rows = await app.prisma.zpzp_linker.findMany({
        where: {
            status: "active",
            member_uid: { in: uids },
        },
        select: { member_uid: true },
    });

    return new Set(
        rows
            .map((row) => Number(row.member_uid))
            .filter((uid) => Number.isFinite(uid) && uid > 0)
    );
}

/** 링커 스코프 주문: 결제 스토어 slug 또는 귀속 회원 주문 */
export function orderInfoWhereForScope(
    base: Prisma.mallRN_order_infoWhereInput,
    scope: LinkerSlugScope | null
): Prisma.mallRN_order_infoWhereInput {
    if (!scope) return base;

    const or: Prisma.mallRN_order_infoWhereInput[] = [
        { checkout_shop_slug: scope.shopSlug },
    ];
    if (scope.memberUids.length > 0) {
        or.push({
            member_uid: { in: scope.memberUids.map((uid) => BigInt(uid)) },
        });
    }
    return { ...base, OR: or };
}

export function isOrderInLinkerScope(
    order: {
        checkout_shop_slug?: string | null;
        member_uid?: bigint | number | null;
    },
    scope: LinkerSlugScope
): boolean {
    if (String(order.checkout_shop_slug ?? "").trim() === scope.shopSlug) return true;
    const mid = Number(order.member_uid ?? 0);
    return Number.isFinite(mid) && mid > 0 && scope.memberUidSet.has(mid);
}

function toSellerLinker(row: {
    uid: number;
    member_uid: number;
    shop_slug: string | null;
    shop_name: string | null;
}): SellerLinker {
    return {
        uid: Number(row.uid),
        member_uid: Number(row.member_uid),
        shop_slug: String(row.shop_slug ?? ""),
        shop_name: String(row.shop_name ?? ""),
    };
}

async function findActiveLinkerForTenant(
    app: FastifyInstance,
    tenantId: bigint | undefined,
    tenantSlug: string,
    memberUid?: number
): Promise<SellerLinker | null> {
    const slug = tenantSlug.trim();
    const memberFilter = memberUid ? { member_uid: memberUid } : {};

    // 링커 slug 로 들어온 경우 shop_slug 를 우선한다.
    // tenant_id OR 매칭을 먼저 쓰면 같은 카탈로그의 다른 링커가 잡힐 수 있다.
    if (slug) {
        const bySlug = await app.prisma.zpzp_linker.findFirst({
            where: {
                status: "active",
                shop_slug: slug,
                ...memberFilter,
            },
        });
        if (bySlug) return toSellerLinker(bySlug);
    }

    if (tenantId != null) {
        const byTenant = await app.prisma.zpzp_linker.findFirst({
            where: {
                status: "active",
                tenant_id: tenantId,
                ...memberFilter,
            },
        });
        if (byTenant) return toSellerLinker(byTenant);
    }

    return null;
}
