// apps/api/src/modules/public/resolve.routes.ts
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

export type SlugKind = "tenant" | "linker" | "none";
export interface SlugResolution { kind: SlugKind; tenantSlug: string | null }

/** slug 종류 해석. tenant 우선, 그다음 active 링커(→ 소속 점포 slug 파생). */
export async function resolveSlug(prisma: PrismaClient, slugRaw: string): Promise<SlugResolution> {
    const slug = String(slugRaw || "").trim().toLowerCase();
    if (!slug) return { kind: "none", tenantSlug: null };

    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { slug: true } });
    if (tenant) return { kind: "tenant", tenantSlug: tenant.slug };

    const linker = await prisma.zpzp_linker.findFirst({
        where: { shop_slug: slug, status: "active" },
        select: { tenant_id: true },
    });
    if (!linker || linker.tenant_id === null) return { kind: "none", tenantSlug: null };

    const owner = await prisma.tenant.findUnique({
        where: { id: linker.tenant_id },
        select: { slug: true },
    });
    if (!owner) return { kind: "none", tenantSlug: null };
    return { kind: "linker", tenantSlug: owner.slug };
}

export const publicResolveRoutes = async (fastify: FastifyInstance) => {
    fastify.get("/v1/resolve-slug", async (request: any, reply) => {
        const slug = String(request.query?.slug || "");
        const result = await resolveSlug(fastify.prisma, slug);
        reply.header("Cache-Control", "public, max-age=60");
        return result;
    });
};
