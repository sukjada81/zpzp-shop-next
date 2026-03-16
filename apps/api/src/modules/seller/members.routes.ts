// apps/api/src/modules/seller/members.routes.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireTenant } from "../../common/guard.js";

const TENANT_CONSUMER_ROLE = "consumer";

function getSessionMemberUid(req: any): number | null {
    const raw =
        req.session?.member?.uid ??
        req.session?.user?.uid ??
        req.session?.authUser?.uid ??
        null;

    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function toStartOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function toStartOfDaysAgo(days: number) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - days);
    return d;
}

function unixToIso(v: unknown) {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n) || n <= 0) return "";
    return new Date(n * 1000).toISOString();
}

function dateToIso(v?: Date | null) {
    return v ? v.toISOString() : "";
}

async function canReadTenantMembers(app: FastifyInstance, req: any, tenantId: bigint) {
    const memberUid = getSessionMemberUid(req);
    if (!memberUid) return false;

    const count = await app.prisma.mallRN_member_membership.count({
        where: {
            member_uid: memberUid,
            status: "active",
            OR: [
                {
                    role_code: { in: ["hq_admin", "hq_staff"] },
                    scope_type: "global",
                },
                {
                    role_code: { in: ["seller_owner", "seller_staff"] },
                    scope_type: "tenant",
                    scope_id: tenantId,
                },
            ],
        },
    });

    return count > 0;
}

export async function sellerMembersRoutes(app: FastifyInstance) {
    app.get(
        "/seller/members",
        { preHandler: requireTenant() },
        async (req: any, reply) => {
            const tenantId = req.tenantId as bigint;
            const tenantSlug = String(req.tenantSlug ?? "");

            const allowed = await canReadTenantMembers(app, req, tenantId);
            if (!allowed) {
                return reply.code(403).send({ ok: false, message: "forbidden" });
            }

            const query = z.object({
                q: z.string().optional(),
                summaryOnly: z.coerce.number().optional(),
            }).parse(req.query ?? {});

            const keyword = String(query.q ?? "").trim();
            const summaryOnly = Number(query.summaryOnly ?? 0) === 1;

            const membershipWhere: any = {
                role_code: TENANT_CONSUMER_ROLE,
                scope_type: "tenant",
                scope_id: tenantId,
                status: "active",
            };

            const memberships = await app.prisma.mallRN_member_membership.findMany({
                where: membershipWhere,
                orderBy: [{ joined_at: "desc" }, { uid: "desc" }],
                select: {
                    uid: true,
                    member_uid: true,
                    role_code: true,
                    status: true,
                    joined_at: true,
                },
            });

            const memberUids = memberships
                .map((x) => Number(x.member_uid))
                .filter((x) => Number.isFinite(x) && x > 0);

            const members = memberUids.length
                ? await app.prisma.mallRN_member.findMany({
                    where: {
                        uid: { in: memberUids },
                        ...(keyword
                            ? {
                                OR: [
                                    { id: { contains: keyword } },
                                    { name: { contains: keyword } },
                                    { cell: { contains: keyword } },
                                    { email: { contains: keyword } },
                                ],
                            }
                            : {}),
                    },
                    select: {
                        uid: true,
                        id: true,
                        name: true,
                        cell: true,
                        email: true,
                        status: true,
                        primary_role: true,
                        created_at_dt: true,
                        last_login_at_dt: true,
                        login_time: true,
                        signdate: true,
                    },
                })
                : [];

            const memberMap = new Map(members.map((m) => [Number(m.uid), m]));

            const items = memberships
                .map((ms) => {
                    const m = memberMap.get(Number(ms.member_uid));
                    if (!m) return null;

                    return {
                        id: String(ms.uid),
                        memberUid: String(m.uid),
                        loginId: String(m.id ?? ""),
                        name: String(m.name ?? ""),
                        phone: String(m.cell ?? ""),
                        email: String(m.email ?? ""),
                        status: String(m.status ?? ms.status ?? "active"),
                        primaryRole: String(m.primary_role ?? ms.role_code ?? TENANT_CONSUMER_ROLE),
                        joinedAt:
                            dateToIso(ms.joined_at) ||
                            dateToIso(m.created_at_dt ?? null) ||
                            unixToIso(m.signdate),
                        lastLoginAt:
                            dateToIso(m.last_login_at_dt ?? null) ||
                            unixToIso(m.login_time),
                    };
                })
                .filter(Boolean);

            const todayStart = toStartOfToday();
            const weekStart = toStartOfDaysAgo(6);

            const todaySignups = memberships.filter((x) => {
                return x.joined_at ? new Date(x.joined_at) >= todayStart : false;
            }).length;

            const weekSignups = memberships.filter((x) => {
                return x.joined_at ? new Date(x.joined_at) >= weekStart : false;
            }).length;

            const todayLogins = members.filter((m) => {
                if (m.last_login_at_dt) return new Date(m.last_login_at_dt) >= todayStart;
                const n = Number(m.login_time ?? 0);
                return Number.isFinite(n) && n > 0 ? new Date(n * 1000) >= todayStart : false;
            }).length;

            return reply.send({
                ok: true,
                tenant: tenantSlug,
                summary: {
                    totalMembers: items.length,
                    todaySignups,
                    weekSignups,
                    todayInflows: 0,
                    todayLogins,
                    sourceReady: true,
                },
                items: summaryOnly ? [] : items,
            });
        }
    );

    app.get(
        "/seller/members/:memberUid",
        { preHandler: requireTenant() },
        async (req: any, reply) => {
            const tenantId = req.tenantId as bigint;
            const tenantSlug = String(req.tenantSlug ?? "");

            const allowed = await canReadTenantMembers(app, req, tenantId);
            if (!allowed) {
                return reply.code(403).send({ ok: false, message: "forbidden" });
            }

            const params = z.object({
                memberUid: z.coerce.number().int().positive(),
            }).parse(req.params ?? {});

            const membership = await app.prisma.mallRN_member_membership.findFirst({
                where: {
                    member_uid: params.memberUid,
                    role_code: TENANT_CONSUMER_ROLE,
                    scope_type: "tenant",
                    scope_id: tenantId,
                    status: "active",
                },
                select: {
                    uid: true,
                    member_uid: true,
                    role_code: true,
                    status: true,
                    joined_at: true,
                },
            });

            if (!membership) {
                return reply.code(404).send({ ok: false, message: "member not found" });
            }

            const member = await app.prisma.mallRN_member.findUnique({
                where: { uid: params.memberUid },
                select: {
                    uid: true,
                    id: true,
                    name: true,
                    tel: true,
                    cell: true,
                    email: true,
                    postcode: true,
                    address1: true,
                    address2: true,
                    memo: true,
                    status: true,
                    primary_role: true,
                    created_at_dt: true,
                    last_login_at_dt: true,
                    login_time: true,
                    signdate: true,
                },
            });

            if (!member) {
                return reply.code(404).send({ ok: false, message: "member not found" });
            }

            return reply.send({
                ok: true,
                tenant: tenantSlug,
                item: {
                    id: String(membership.uid),
                    memberUid: String(member.uid),
                    loginId: String(member.id ?? ""),
                    name: String(member.name ?? ""),
                    tel: String(member.tel ?? ""),
                    phone: String(member.cell ?? ""),
                    email: String(member.email ?? ""),
                    postcode: String(member.postcode ?? ""),
                    address1: String(member.address1 ?? ""),
                    address2: String(member.address2 ?? ""),
                    memo: String(member.memo ?? ""),
                    status: String(member.status ?? membership.status ?? "active"),
                    primaryRole: String(member.primary_role ?? membership.role_code ?? TENANT_CONSUMER_ROLE),
                    joinedAt:
                        dateToIso(membership.joined_at) ||
                        dateToIso(member.created_at_dt ?? null) ||
                        unixToIso(member.signdate),
                    lastLoginAt:
                        dateToIso(member.last_login_at_dt ?? null) ||
                        unixToIso(member.login_time),
                },
            });
        }
    );
}