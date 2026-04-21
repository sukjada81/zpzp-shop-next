// apps/api/src/modules/seller/applications.routes.ts
import type { FastifyInstance } from "fastify";

const SUPER_ADMIN_ROLE = "hq_super";
const SELLER_ROLES = ["seller_owner", "seller_staff"];

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
    // hq_super 여부 확인 (tenant 없이 호출 가능)
    app.get("/v1/seller/super-check", async (req: any, reply) => {
        const member = getSessionMember(req);
        if (!member?.uid) return reply.code(401).send({ ok: false, isSuperAdmin: false });

        const memberUid = toInt(member.uid, 0);
        const ms = await app.prisma.mallRN_member_membership.findFirst({
            where: { member_uid: memberUid, status: "active", scope_type: "global", role_code: SUPER_ADMIN_ROLE },
        });

        return reply.send({ ok: true, isSuperAdmin: !!ms });
    });

    // 셀러 신청 목록 (전체 테넌트) — 같은 (member_uid, scope_id) 쌍으로 그룹핑
    app.get("/v1/seller/applications", async (req: any, reply) => {
        if (!(await requireSuperAdmin(app, req, reply))) return;

        const statusFilter = String(req.query?.status ?? "all").trim();
        const validStatuses = ["pending", "active", "all"];
        const status = validStatuses.includes(statusFilter) ? statusFilter : "all";

        const rows = await app.prisma.mallRN_member_membership.findMany({
            where: {
                scope_type: "tenant",
                role_code: { in: SELLER_ROLES },
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

        const memberMap = new Map(members.map((m) => [String(m.uid), m]));
        const tenantMap = new Map(tenants.map((t) => [String(t.id), t]));

        // (member_uid, scope_id) 기준으로 그룹핑
        const grouped = new Map<string, {
            id: number;
            memberUid: number;
            roleCodes: string[];
            status: string;
            scopeId: bigint | null;
            joinedAt: Date | null;
        }>();

        for (const r of rows) {
            const key = `${r.member_uid}-${r.scope_id}`;
            const existing = grouped.get(key);
            if (existing) {
                const rc = String(r.role_code ?? "");
                if (rc && !existing.roleCodes.includes(rc)) {
                    existing.roleCodes.push(rc);
                }
                // pending이 하나라도 있으면 그룹 상태를 pending으로
                if (r.status === "pending") existing.status = "pending";
            } else {
                grouped.set(key, {
                    id: Number(r.uid),
                    memberUid: Number(r.member_uid),
                    roleCodes: [String(r.role_code ?? "")].filter(Boolean),
                    status: String(r.status ?? ""),
                    scopeId: r.scope_id ?? null,
                    joinedAt: r.joined_at ?? null,
                });
            }
        }

        const items = Array.from(grouped.values()).map((g) => {
            const member = memberMap.get(String(g.memberUid));
            const tenant = tenantMap.get(String(g.scopeId));
            return {
                id: g.id,
                memberUid: g.memberUid,
                memberName: member?.name ?? "-",
                memberPhone: member?.cell ?? "-",
                memberEmail: member?.email ?? "-",
                roleCodes: g.roleCodes,
                status: g.status,
                tenantId: g.scopeId ? Number(g.scopeId) : null,
                tenantSlug: tenant?.slug ?? "-",
                tenantName: tenant?.name ?? "-",
                joinedAt: g.joinedAt?.toISOString() ?? null,
            };
        });

        return reply.send({ ok: true, items });
    });

    // 승인 — 같은 (member_uid, scope_id) 그룹 전체를 active로
    app.post("/v1/seller/applications/:id/approve", async (req: any, reply) => {
        if (!(await requireSuperAdmin(app, req, reply))) return;

        const id = toInt(req.params?.id, 0);
        if (!id) return reply.code(400).send({ ok: false, message: "invalid id" });

        const ms = await app.prisma.mallRN_member_membership.findFirst({
            where: { uid: id, scope_type: "tenant", role_code: { in: SELLER_ROLES } },
        });

        if (!ms) return reply.code(404).send({ ok: false, message: "not found" });

        await app.prisma.mallRN_member_membership.updateMany({
            where: {
                member_uid: ms.member_uid,
                scope_id: ms.scope_id,
                scope_type: "tenant",
                role_code: { in: SELLER_ROLES },
            },
            data: { status: "active" },
        });

        return reply.send({ ok: true });
    });

    // 회원 셀러 권한 삭제 — 해당 member_uid의 모든 seller 멤버십 제거
    app.delete("/v1/seller/applications/member/:memberUid", async (req: any, reply) => {
        if (!(await requireSuperAdmin(app, req, reply))) return;

        const memberUid = toInt(req.params?.memberUid, 0);
        if (!memberUid) return reply.code(400).send({ ok: false, message: "invalid memberUid" });

        await app.prisma.mallRN_member_membership.deleteMany({
            where: {
                member_uid: memberUid,
                scope_type: "tenant",
                role_code: { in: SELLER_ROLES },
            },
        });

        return reply.send({ ok: true });
    });
}
