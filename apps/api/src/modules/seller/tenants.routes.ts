// apps/api/src/modules/seller/tenants.routes.ts
import type { FastifyInstance } from "fastify";

const GLOBAL_ADMIN_ROLES = ["hq_admin", "hq_staff", "hq_super"] as const;

type MemberSession = {
    uid?: string | number;
};

function getSessionMember(req: any): MemberSession | null {
    const member = req.session?.member as MemberSession | undefined;
    if (!member?.uid) return null;
    return member;
}

function toInt(v: unknown, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function sellerTenantsRoutes(app: FastifyInstance) {
    // admin 전용 — 전체 지점 목록
    app.get("/v1/seller/tenants", async (req: any, reply) => {
        const member = getSessionMember(req);
        if (!member?.uid) {
            return reply.code(401).send({ ok: false, message: "login required" });
        }

        const memberUid = toInt(member.uid, 0);
        if (memberUid <= 0) {
            return reply.code(401).send({ ok: false, message: "invalid session" });
        }

        const globalMs = await app.prisma.mallRN_member_membership.findFirst({
            where: {
                member_uid: memberUid,
                status: "active",
                scope_type: "global",
                role_code: { in: [...GLOBAL_ADMIN_ROLES] },
            },
            select: { role_code: true },
        });

        if (!globalMs) {
            return reply.code(403).send({ ok: false, message: "admin permission required" });
        }

        const rows = await app.prisma.tenant.findMany({
            where: { status: "active" },
            select: { id: true, slug: true, name: true },
            orderBy: { id: "asc" },
        });

        return reply.send({
            ok: true,
            items: rows.map((t) => ({
                id: Number(t.id),
                slug: t.slug,
                name: t.name,
            })),
        });
    });
}
