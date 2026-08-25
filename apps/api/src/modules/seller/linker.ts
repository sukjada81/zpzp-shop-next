// apps/api/src/modules/seller/linker.ts
// 셀러 콘솔의 링커 판별 — 상품관리·정산이 같은 규칙을 쓰도록 공용화.
// 규칙: 세션 member_uid + status='active' + (tenant_id 일치 ‖ shop_slug 가 현재 tenant)
// 링커는 소속 점포가 없어 tenant_id 가 NULL 이므로(shop-php lib/linker_apply.php 방향교정)
// 실무상 shop_slug 매칭이 주 경로다.
import type { FastifyInstance, FastifyRequest } from "fastify";

export type SellerLinker = {
    uid: number;
    member_uid: number;
    shop_slug: string;
    shop_name: string;
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
