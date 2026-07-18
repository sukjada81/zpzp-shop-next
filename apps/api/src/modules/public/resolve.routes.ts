// apps/api/src/modules/public/resolve.routes.ts
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

export type SlugKind = "tenant" | "linker" | "none";
export interface SlugResolution { kind: SlugKind; tenantSlug: string | null }

// 링커가 rewrite될 단일 본사몰 컨텍스트 slug. dad_tenants 에 이 slug 의 tenant 행이 존재해야 하며,
// 그 tenant 는 자기 상품이 없어 buildPublicGoodsWhere 가 본사 상품(tenant_id=0)만 노출한다.
export const HQ_STOREFRONT_SLUG = "hq";

/** slug 종류 해석. tenant 우선, 그다음 active 링커(→ 단일 본사몰 컨텍스트 'hq'). */
export async function resolveSlug(prisma: PrismaClient, slugRaw: string): Promise<SlugResolution> {
    const slug = String(slugRaw || "").trim().toLowerCase();
    if (!slug) return { kind: "none", tenantSlug: null };

    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { slug: true } });
    if (tenant) return { kind: "tenant", tenantSlug: tenant.slug };

    // [2026-07-18 방향교정] 링커 = 독립 매장(본사 상품 판매), 특정 점포에 묶이지 않음.
    // active 링커는 소속 점포가 아니라 단일 본사몰 컨텍스트(HQ_STOREFRONT_SLUG)로 rewrite한다.
    // 본사 카탈로그 노출: buildPublicGoodsWhere(hqTenantId) = tenant_id IN (hqId, 0) → 본사 상품(tenant_id=0)만.
    const linker = await prisma.zpzp_linker.findFirst({
        where: { shop_slug: slug, status: "active" },
        select: { uid: true },
    });
    if (!linker) return { kind: "none", tenantSlug: null };
    return { kind: "linker", tenantSlug: HQ_STOREFRONT_SLUG };
}

export const publicResolveRoutes = async (fastify: FastifyInstance) => {
    fastify.get("/v1/resolve-slug", async (request: any, reply) => {
        const slug = String(request.query?.slug || "");
        const result = await resolveSlug(fastify.prisma, slug);
        reply.header("Cache-Control", "public, max-age=60");
        return result;
    });
};
