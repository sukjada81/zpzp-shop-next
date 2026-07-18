// apps/api/src/modules/admin/tenants.routes.ts
import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../common/guard.js";
import { jsonSafe } from "../../common/jsonSafe.js";

/**
 * Tenants (지점) 관리
 * - 통합 관리자 전용 (is_super_admin)
 * - 목록/상세/생성/수정
 *
 * Query:
 *  - q: slug/primaryDomain 검색
 *  - status: active|inactive|draft 등
 *  - page, pageSize
 */
export async function adminTenantsRoutes(app: FastifyInstance) {
    // ✅ 전부 통합관리자 전용
    app.addHook("preHandler", requireAdmin({ superOnly: true }));

    // GET /admin/tenants
    app.get("/tenants", async (req, reply) => {
        const q = String((req.query as any)?.q ?? "").trim();
        const status = String((req.query as any)?.status ?? "").trim();
        const page = Math.max(1, Number((req.query as any)?.page ?? 1));
        const pageSize = Math.min(100, Math.max(1, Number((req.query as any)?.pageSize ?? 20)));

        const where: any = {};
        if (status) where.status = status;
        if (q) {
            where.OR = [
                { slug: { contains: q } },
                { primaryDomain: { contains: q } }, // ✅ domain -> primaryDomain
            ];
        }

        const [total, rows] = await Promise.all([
            app.prisma.tenant.count({ where }),
            app.prisma.tenant.findMany({
                where,
                orderBy: { id: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);

        return reply.send(
            jsonSafe({
                ok: true,
                page,
                pageSize,
                total,
                tenants: rows,
            })
        );
    });

    // GET /admin/tenants/:id
    app.get("/tenants/:id", async (req, reply) => {
        const id = BigInt((req.params as any).id);
        const tenant = await app.prisma.tenant.findUnique({ where: { id } });
        if (!tenant) return reply.code(404).send({ ok: false, message: "TENANT_NOT_FOUND" });

        return reply.send(jsonSafe({ ok: true, tenant }));
    });

    // POST /admin/tenants
    app.post("/tenants", async (req, reply) => {
        const body = (req.body ?? {}) as any;

        const slug = String(body.slug ?? "").trim();
        const name = String(body.name ?? "").trim();
        const primaryDomain = String(body.primaryDomain ?? "").trim();
        const status = String(body.status ?? "active").trim();
        const timezone = String(body.timezone ?? "Asia/Seoul").trim();
        const themeJson = body.themeJson ?? null;

        if (!slug) return reply.code(400).send({ ok: false, message: "SLUG_REQUIRED" });
        if (!name) return reply.code(400).send({ ok: false, message: "NAME_REQUIRED" });

        const exists = await app.prisma.tenant.findFirst({ where: { slug } });
        if (exists) return reply.code(409).send({ ok: false, message: "SLUG_ALREADY_EXISTS" });

        // primaryDomain unique
        if (primaryDomain) {
            const dupDomain = await app.prisma.tenant.findFirst({ where: { primaryDomain } });
            if (dupDomain) return reply.code(409).send({ ok: false, message: "PRIMARY_DOMAIN_ALREADY_EXISTS" });
        }

        const created = await app.prisma.tenant.create({
            data: {
                slug,
                name,
                primaryDomain: primaryDomain || null,
                status,
                timezone,
                themeJson: themeJson ? JSON.stringify(themeJson) : null,
            },
        });

        return reply.send(jsonSafe({ ok: true, tenant: created }));
    });

    // PUT /admin/tenants/:id
    app.put("/tenants/:id", async (req, reply) => {
        const id = BigInt((req.params as any).id);
        const body = (req.body ?? {}) as any;

        const slug = String(body.slug ?? "").trim();
        const name = String(body.name ?? "").trim();
        const primaryDomain = String(body.primaryDomain ?? "").trim();
        const status = String(body.status ?? "").trim();
        const timezone = String(body.timezone ?? "").trim();
        const themeJson = body.themeJson ?? undefined;

        const current = await app.prisma.tenant.findUnique({ where: { id } });
        if (!current) return reply.code(404).send({ ok: false, message: "TENANT_NOT_FOUND" });

        if (!slug) return reply.code(400).send({ ok: false, message: "SLUG_REQUIRED" });
        if (!name) return reply.code(400).send({ ok: false, message: "NAME_REQUIRED" });

        // slug 변경 시 중복 검사
        if (slug !== current.slug) {
            const dup = await app.prisma.tenant.findFirst({ where: { slug } });
            if (dup) return reply.code(409).send({ ok: false, message: "SLUG_ALREADY_EXISTS" });
        }

        // primaryDomain 변경 시 unique 검사
        if (primaryDomain !== (current.primaryDomain ?? "")) {
            if (primaryDomain) {
                const dupDomain = await app.prisma.tenant.findFirst({ where: { primaryDomain } });
                if (dupDomain && dupDomain.id !== id) {
                    return reply.code(409).send({ ok: false, message: "PRIMARY_DOMAIN_ALREADY_EXISTS" });
                }
            }
        }

        const updated = await app.prisma.tenant.update({
            where: { id },
            data: {
                slug,
                name,
                primaryDomain: primaryDomain || null,
                status: status || current.status,
                timezone: timezone || current.timezone,
                ...(themeJson === undefined
                    ? {}
                    : { themeJson: themeJson ? JSON.stringify(themeJson) : null }),
            },
        });

        return reply.send(jsonSafe({ ok: true, tenant: updated }));
    });
}