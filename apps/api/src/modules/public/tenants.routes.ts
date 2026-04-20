// apps/api/src/modules/public/tenants.routes.ts
import type { FastifyInstance } from "fastify";

function normalizeTenant(raw: unknown) {
    const t = String(raw ?? "").trim().toLowerCase();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

export async function publicTenantRoutes(app: FastifyInstance) {
    app.get("/v1/public/tenant", async (req, reply) => {
        const params = req.params as { tenant?: string };
        const tenantSlug = normalizeTenant(params?.tenant);

        if (!tenantSlug) {
            return reply.code(400).send({
                ok: false,
                message: "tenant is required",
            });
        }

        const row = await app.prisma.tenant.findFirst({
            where: {
                slug: tenantSlug,
                status: "active",
            },
            select: {
                id: true,
                slug: true,
                name: true,
                primaryDomain: true,
                timezone: true,
                status: true,
            },
        });

        if (!row) {
            return reply.code(404).send({
                ok: false,
                message: "tenant not found",
            });
        }

        return {
            ok: true,
            item: {
                id: Number(row.id),
                slug: row.slug,
                name: row.name,
                primaryDomain: row.primaryDomain ?? null,
                timezone: row.timezone,
                status: row.status,
            },
        };
    });
}