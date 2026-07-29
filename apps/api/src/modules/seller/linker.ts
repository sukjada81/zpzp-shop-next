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
    const uid = (req as any).session?.member?.uid;
    const n = Number(uid);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

export async function getLinker(app: FastifyInstance, req: FastifyRequest): Promise<SellerLinker | null> {
    const uid = memberUidFromSession(req);
    if (!uid) return null;

    const tenantId = (req as any).tenantId as bigint | undefined;
    const tenantSlug = String((req as any).tenantSlug ?? "").trim();
    const tenantScope: Array<{ tenant_id: bigint } | { shop_slug: string }> = [];
    if (tenantId != null) tenantScope.push({ tenant_id: tenantId });
    if (tenantSlug) tenantScope.push({ shop_slug: tenantSlug });
    if (tenantScope.length === 0) return null;

    const row = await app.prisma.zpzp_linker.findFirst({
        where: {
            member_uid: uid,
            status: "active",
            OR: tenantScope,
        },
    });

    if (!row) return null;

    return {
        uid: Number(row.uid),
        member_uid: Number(row.member_uid),
        shop_slug: String(row.shop_slug ?? ""),
        shop_name: String(row.shop_name ?? ""),
    };
}
