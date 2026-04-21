// apps/api/src/modules/seller/applications.routes.ts
import type { FastifyInstance } from "fastify";

const SUPER_ADMIN_ROLE = "hq_super";

type MemberSession = { uid?: string | number };

function getSessionMember(req: any): MemberSession | null {
    const member = req.session?.member as MemberSession | undefined;
    if (!member?.uid) return null;
    return member;
}

function toInt(v: unknown, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

async function requireSuperAdmin(
    app: FastifyInstance,
    req: any,
    reply: any
): Promise<boolean> {
    const member = getSessionMember(req);
    if (!member?.uid) {
        reply.code(401).send({ ok: false, message: "login required" });
        return false;
    }

    const memberUid = toInt(member.uid, 0);
    const ms = await app.prisma.mallRN_member_membership.findFirst({
        where: {
            member_uid: memberUid,
            status: "active",
            scope_type: "global",
            role_code: SUPER_ADMIN_ROLE,
        },
    });

    if (!ms) {
        reply.code(403).send({ ok: false, message: "super admin required" });
        return false;
    }

    return true;
}

export async function sellerApplicationsRoutes(app: FastifyInstance) {
    // 셀러 신청 목록 (전체 테넌트)
    app.get("/v1/seller/applications", async (req: any, reply) => {
        if (!(await requireSuperAdmin(app, req, reply))) return;

        const statusFilter = String(req.query?.status ?? "pending").trim();
        const validStatuses = ["pending", "active", "rejected", "all"];
        const status = validStatuses.includes(statusFilter) ? statusFilter : "pending";

        const rows = await app.prisma.mallRN_member_membership.findMany({
            where: {
                scope_type: "tenant",
                role_code: { in: ["seller_owner", "seller_staff"] },
                ...(status !== "all" ? { status } : {}),
            },
            select: {
                uid: true,
                member_uid: true,
                role_code: true,
                status: true,
                joined_at: true,
                scope_id: true,
            },
            orderBy: { joined_at: "desc" },
        });

        if (rows.length === 0) {
            return reply.send({ ok: true, items: [] });
        }

        const memberUids = [...new Set(rows.map((r) => r.member_uid))];
        const tenantIds = [...new Set(rows.map((r) => r.scope_id).filter(Boolean))] as bigint[];

        const [members, tenants] = await Promise.all([
            app.prisma.mallRN_member.findMany({
                where: { uid: { in: memberUids } },
                select: { uid: true, name: true, cell: true, email: true },
            }),
            app.prisma.tenant.findMany({
                where: { id: { in: tenantIds } },
                select: { id: true, slug: true, name: true },
            }),
        ]);

        const memberMap = new Map(members.map((m) => [m.uid, m]));
        const tenantMap = new Map(tenants.map((t) => [String(t.id), t]));

        const items = rows.map((r) => {
            const member = memberMap.get(r.member_uid);
            const tenant = tenantMap.get(String(r.scope_id));
            return {
                id: Number(r.uid),
                memberUid: r.member_uid,
                memberName: member?.name ?? "-",
                memberPhone: member?.cell ?? "-",
                memberEmail: member?.email ?? "-",
                roleCode: r.role_code,
                status: r.status,
                tenantId: r.scope_id ? Number(r.scope_id) : null,
                tenantSlug: tenant?.slug ?? "-",
                tenantName: tenant?.name ?? "-",
                joinedAt: r.joined_at?.toISOString() ?? null,
            };
        });

        return reply.send({ ok: true, items });
    });

    // 승인
    app.post("/v1/seller/applications/:id/approve", async (req: any, reply) => {
        if (!(await requireSuperAdmin(app, req, reply))) return;

        const id = toInt(req.params?.id, 0);
        if (!id) return reply.code(400).send({ ok: false, message: "invalid id" });

        const ms = await app.prisma.mallRN_member_membership.findFirst({
            where: { uid: id, scope_type: "tenant", role_code: { in: ["seller_owner", "seller_staff"] } },
        });

        if (!ms) return reply.code(404).send({ ok: false, message: "not found" });
        if (ms.status === "active") return reply.send({ ok: true, message: "already active" });

        await app.prisma.mallRN_member_membership.update({
            where: { uid: id },
            data: { status: "active" },
        });

        return reply.send({ ok: true });
    });

    // 거절
    app.post("/v1/seller/applications/:id/reject", async (req: any, reply) => {
        if (!(await requireSuperAdmin(app, req, reply))) return;

        const id = toInt(req.params?.id, 0);
        if (!id) return reply.code(400).send({ ok: false, message: "invalid id" });

        const ms = await app.prisma.mallRN_member_membership.findFirst({
            where: { uid: id, scope_type: "tenant", role_code: { in: ["seller_owner", "seller_staff"] } },
        });

        if (!ms) return reply.code(404).send({ ok: false, message: "not found" });

        await app.prisma.mallRN_member_membership.update({
            where: { uid: id },
            data: { status: "rejected" },
        });

        return reply.send({ ok: true });
    });
}
