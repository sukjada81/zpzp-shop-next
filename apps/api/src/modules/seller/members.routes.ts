// apps/api/src/modules/seller/members.routes.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireTenant } from "../../common/guard.js";
import { getTenantLinker } from "./linker.js";

const TENANT_CONSUMER_ROLE = "consumer";
const GLOBAL_ALLOWED_ROLES = ["hq_admin", "hq_staff", "hq_super"] as const;
const TENANT_ALLOWED_ROLES = ["seller_owner", "seller_staff"] as const;

type MemberSession = {
    uid?: string | number;
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    provider?: string;
    tenantId?: string | number;
    tenantSlug?: string;
};

type TenantRequest = {
    tenantId?: bigint;
    tenantSlug?: string;
    session?: { member?: MemberSession };
    query?: unknown;
    params?: unknown;
};

type ConsumerMembershipRow = {
    uid: bigint;
    member_uid: number;
    role_code: string;
    status: string;
    joined_at: Date | null;
};

type MemberListRow = {
    uid: number;
    id: string | null;
    name: string | null;
    cell: string | null;
    email: string | null;
    status: string | null;
    primary_role: string | null;
    reference: string | null;
    created_at_dt: Date | null;
    last_login_at_dt: Date | null;
    login_time: bigint | number | null;
    signdate: bigint | number | null;
};

function getSessionMember(req: TenantRequest): MemberSession | null {
    const member = req.session?.member;
    if (!member?.uid) return null;
    return member;
}

function getSessionMemberUid(req: TenantRequest): number | null {
    const member = getSessionMember(req);
    if (!member?.uid) return null;

    const n = Number(member.uid);
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

function isActiveAttributionStatus(status: string) {
    return Boolean(status) && status !== "revoked";
}

async function resolveSellerMemberPermission(
    app: FastifyInstance,
    req: TenantRequest,
    tenantId: bigint
): Promise<
    | {
          ok: true;
          memberUid: number;
          grantedRole: string;
          grantedScopeType: "global" | "tenant";
      }
    | {
          ok: false;
          code: 401 | 403;
          message: string;
      }
> {
    const memberUid = getSessionMemberUid(req);
    if (!memberUid) {
        return { ok: false, code: 401, message: "seller login required" };
    }

    const memberRow = await app.prisma.mallRN_member.findFirst({
        where: {
            uid: memberUid,
            status: "active",
            deleted_at: null,
        },
        select: {
            uid: true,
        },
    });

    if (!memberRow) {
        return { ok: false, code: 403, message: "seller permission denied" };
    }

    const membership = await app.prisma.mallRN_member_membership.findFirst({
        where: {
            member_uid: memberUid,
            status: "active",
            OR: [
                {
                    scope_type: "global",
                    role_code: {
                        in: [...GLOBAL_ALLOWED_ROLES],
                    },
                },
                {
                    scope_type: "tenant",
                    scope_id: tenantId,
                    role_code: {
                        in: [...TENANT_ALLOWED_ROLES],
                    },
                },
            ],
        },
        orderBy: [{ is_primary: "desc" }, { uid: "asc" }],
        select: {
            role_code: true,
            scope_type: true,
        },
    });

    if (!membership) {
        return { ok: false, code: 403, message: "seller permission denied" };
    }

    return {
        ok: true,
        memberUid,
        grantedRole: String(membership.role_code ?? ""),
        grantedScopeType: membership.scope_type === "global" ? "global" : "tenant",
    };
}

function buildMemberItems(
    memberships: ConsumerMembershipRow[],
    memberMap: Map<number, MemberListRow>,
    attributedMap: Map<number, string>
) {
    return memberships
        .map((row) => {
            const m = memberMap.get(Number(row.member_uid));
            if (!m) return null;
            const crewStatus = attributedMap.get(Number(row.member_uid)) || "";

            return {
                id: String(row.uid),
                memberUid: String(m.uid),
                loginId: String(m.id ?? ""),
                name: String(m.name ?? ""),
                phone: String(m.cell ?? ""),
                email: String(m.email ?? ""),
                status: String(m.status ?? row.status ?? "active"),
                primaryRole: String(m.primary_role ?? row.role_code ?? TENANT_CONSUMER_ROLE),
                referrer: String(m.reference ?? ""),
                isAttributed: isActiveAttributionStatus(crewStatus),
                attributionStatus: crewStatus,
                joinedAt:
                    dateToIso(row.joined_at ?? null) ||
                    dateToIso(m.created_at_dt ?? null) ||
                    unixToIso(m.signdate),
                lastLoginAt:
                    dateToIso(m.last_login_at_dt ?? null) ||
                    unixToIso(m.login_time),
            };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function sellerMembersRoutes(app: FastifyInstance) {
    app.get(
        "/v1/seller/members",
        { preHandler: requireTenant() },
        async (req, reply) => {
            const tenantReq = req as TenantRequest;
            const tenantId = tenantReq.tenantId as bigint;
            const tenantSlug = String(tenantReq.tenantSlug ?? "");

            const permission = await resolveSellerMemberPermission(app, tenantReq, tenantId);
            if (!permission.ok) {
                return reply.code(permission.code).send({
                    ok: false,
                    message: permission.message,
                });
            }

            const query = z
                .object({
                    q: z.string().optional(),
                    summaryOnly: z.coerce.number().optional(),
                })
                .parse(tenantReq.query ?? {});

            const keyword = String(query.q ?? "").trim();
            const summaryOnly = Number(query.summaryOnly ?? 0) === 1;

            const memberships: ConsumerMembershipRow[] =
                await app.prisma.mallRN_member_membership.findMany({
                    where: {
                        role_code: TENANT_CONSUMER_ROLE,
                        scope_type: "tenant",
                        scope_id: tenantId,
                        status: "active",
                    },
                    orderBy: [{ joined_at: "desc" }, { uid: "desc" }],
                    select: {
                        uid: true,
                        member_uid: true,
                        role_code: true,
                        status: true,
                        joined_at: true,
                    },
                });

            const tenantLinker = await getTenantLinker(app, tenantId, tenantSlug);
            const attributions = tenantLinker
                ? await app.prisma.zpzp_referral_attribution.findMany({
                      where: { linker_id: tenantLinker.uid },
                      select: {
                          member_uid: true,
                          crew_status: true,
                      },
                  })
                : [];
            const attributedMap = new Map(
                attributions.map((row) => [Number(row.member_uid), String(row.crew_status ?? "")])
            );

            const memberUids = memberships
                .map((row) => Number(row.member_uid))
                .filter((uid) => Number.isFinite(uid) && uid > 0);

            const members: MemberListRow[] = memberUids.length
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
                          reference: true,
                          created_at_dt: true,
                          last_login_at_dt: true,
                          login_time: true,
                          signdate: true,
                      },
                  })
                : [];

            const memberMap = new Map(members.map((m) => [Number(m.uid), m]));
            const visibleMemberUids = new Set(members.map((m) => Number(m.uid)));
            const visibleMemberships = memberships.filter((row) =>
                visibleMemberUids.has(Number(row.member_uid))
            );

            const items = buildMemberItems(visibleMemberships, memberMap, attributedMap);

            const todayStart = toStartOfToday();
            const weekStart = toStartOfDaysAgo(6);

            const todaySignups = visibleMemberships.filter((row) => {
                const joinedAt = row.joined_at ?? null;
                return joinedAt ? new Date(joinedAt) >= todayStart : false;
            }).length;

            const weekSignups = visibleMemberships.filter((row) => {
                const joinedAt = row.joined_at ?? null;
                return joinedAt ? new Date(joinedAt) >= weekStart : false;
            }).length;

            const todayLogins = members.filter((m) => {
                if (m.last_login_at_dt) return new Date(m.last_login_at_dt) >= todayStart;
                const n = Number(m.login_time ?? 0);
                return Number.isFinite(n) && n > 0 ? new Date(n * 1000) >= todayStart : false;
            }).length;

            const attributedMembers = visibleMemberships.filter((row) => {
                const status = attributedMap.get(Number(row.member_uid)) || "";
                return isActiveAttributionStatus(status);
            }).length;

            return reply.send({
                ok: true,
                tenant: tenantSlug,
                summary: {
                    totalMembers: items.length,
                    attributedMembers,
                    todaySignups,
                    weekSignups,
                    todayInflows: 0,
                    todayLogins,
                    sourceReady: true,
                },
                items: summaryOnly ? [] : items,
                actor: {
                    role: permission.grantedRole,
                    scopeType: permission.grantedScopeType,
                },
            });
        }
    );

    app.get(
        "/v1/seller/members/:memberUid",
        { preHandler: requireTenant() },
        async (req, reply) => {
            const tenantReq = req as TenantRequest;
            const tenantId = tenantReq.tenantId as bigint;
            const tenantSlug = String(tenantReq.tenantSlug ?? "");

            const permission = await resolveSellerMemberPermission(app, tenantReq, tenantId);
            if (!permission.ok) {
                return reply.code(permission.code).send({
                    ok: false,
                    message: permission.message,
                });
            }

            const params = z
                .object({
                    memberUid: z.coerce.number().int().positive(),
                })
                .parse(tenantReq.params ?? {});

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

            const tenantLinker = await getTenantLinker(app, tenantId, tenantSlug);
            const attribution = tenantLinker
                ? await app.prisma.zpzp_referral_attribution.findFirst({
                      where: {
                          member_uid: params.memberUid,
                          linker_id: tenantLinker.uid,
                      },
                      select: {
                          uid: true,
                          crew_status: true,
                      },
                  })
                : null;

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
                    reference: true,
                    created_at_dt: true,
                    last_login_at_dt: true,
                    login_time: true,
                    signdate: true,
                },
            });

            if (!member) {
                return reply.code(404).send({ ok: false, message: "member not found" });
            }

            const crewStatus = String(attribution?.crew_status ?? "");

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
                    referrer: String(member.reference ?? ""),
                    status: String(member.status ?? membership.status ?? "active"),
                    primaryRole: String(
                        member.primary_role ?? membership.role_code ?? TENANT_CONSUMER_ROLE
                    ),
                    isAttributed: isActiveAttributionStatus(crewStatus),
                    attributionStatus: crewStatus,
                    joinedAt:
                        dateToIso(membership.joined_at ?? null) ||
                        dateToIso(member.created_at_dt ?? null) ||
                        unixToIso(member.signdate),
                    lastLoginAt:
                        dateToIso(member.last_login_at_dt ?? null) ||
                        unixToIso(member.login_time),
                },
                actor: {
                    role: permission.grantedRole,
                    scopeType: permission.grantedScopeType,
                },
            });
        }
    );
}
