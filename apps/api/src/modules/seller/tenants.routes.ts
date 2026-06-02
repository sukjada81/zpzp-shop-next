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

// themeJson 에서 openchatUrl 만 추출해 응답에 노출
function parseOpenchatUrl(themeJson: string | null | undefined): string | null {
    if (!themeJson) return null;
    try {
        const parsed = JSON.parse(themeJson);
        const v = parsed?.openchatUrl;
        return typeof v === "string" && v ? v : null;
    } catch {
        return null;
    }
}

// 기존 themeJson 을 파싱해 openchatUrl 키만 교체한 새 JSON 문자열(없으면 null) 반환.
// openchatUrl === undefined 이면 기존 그대로 유지.
function mergeOpenchatUrl(
    themeJson: string | null | undefined,
    openchatUrl: string | undefined
): string | null {
    let existing: Record<string, any> = {};
    if (themeJson) {
        try {
            existing = JSON.parse(themeJson) ?? {};
        } catch {
            existing = {};
        }
    }
    if (openchatUrl === undefined) {
        return Object.keys(existing).length ? JSON.stringify(existing) : null;
    }
    const v = String(openchatUrl).trim();
    if (v) existing.openchatUrl = v;
    else delete existing.openchatUrl;
    return Object.keys(existing).length ? JSON.stringify(existing) : null;
}

// hq_super 전용 가드 — 쓰기 엔드포인트에서 사용
async function requireHqSuper(
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
    if (memberUid <= 0) {
        reply.code(401).send({ ok: false, message: "invalid session" });
        return false;
    }
    const ms = await app.prisma.mallRN_member_membership.findFirst({
        where: {
            member_uid: memberUid,
            status: "active",
            scope_type: "global",
            role_code: "hq_super",
        },
    });
    if (!ms) {
        reply.code(403).send({ ok: false, message: "super admin required" });
        return false;
    }
    return true;
}

export async function sellerTenantsRoutes(app: FastifyInstance) {
    // GET 목록 — hq_admin / hq_staff / hq_super
    // 쿼리: ?status=active|inactive|draft|all (기본 active — 기존 테넌트 스위처 호환)
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

        const rawStatus = String((req.query as any)?.status ?? "").trim();
        const validStatuses = ["active", "inactive", "draft", "all"];
        const statusFilter = validStatuses.includes(rawStatus) ? rawStatus : "active";

        const where: any = statusFilter === "all" ? {} : { status: statusFilter };

        const rows = await app.prisma.tenant.findMany({
            where,
            select: {
                id: true,
                slug: true,
                name: true,
                status: true,
                primaryDomain: true,
                themeJson: true,
            },
            orderBy: { id: "asc" },
        });

        return reply.send({
            ok: true,
            items: rows.map((t: any) => ({
                id: Number(t.id),
                slug: t.slug,
                name: t.name,
                status: t.status,
                primaryDomain: t.primaryDomain,
                openchatUrl: parseOpenchatUrl(t.themeJson),
            })),
        });
    });

    // GET 상세 — hq_admin / hq_staff / hq_super
    app.get("/v1/seller/tenants/:id", async (req: any, reply) => {
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

        const idRaw = String((req.params as any)?.id ?? "");
        if (!/^\d+$/.test(idRaw)) {
            return reply.code(400).send({ ok: false, message: "INVALID_ID" });
        }
        const id = BigInt(idRaw);

        const t = await app.prisma.tenant.findUnique({ where: { id } });
        if (!t) return reply.code(404).send({ ok: false, message: "TENANT_NOT_FOUND" });

        return reply.send({
            ok: true,
            tenant: {
                id: Number(t.id),
                slug: t.slug,
                name: t.name,
                status: t.status,
                primaryDomain: t.primaryDomain,
                timezone: t.timezone,
                openchatUrl: parseOpenchatUrl(t.themeJson),
            },
        });
    });

    // POST 신규 등록 — hq_super 전용
    app.post("/v1/seller/tenants", async (req: any, reply) => {
        if (!(await requireHqSuper(app, req, reply))) return;

        const body = (req.body ?? {}) as any;
        const slug = String(body.slug ?? "").trim();
        const name = String(body.name ?? "").trim();
        const rawStatus = String(body.status ?? "active").trim();
        const primaryDomain = String(body.primaryDomain ?? "").trim();
        const openchatUrl =
            body.openchatUrl !== undefined ? String(body.openchatUrl).trim() : undefined;

        if (!slug) return reply.code(400).send({ ok: false, message: "SLUG_REQUIRED" });
        if (!name) return reply.code(400).send({ ok: false, message: "NAME_REQUIRED" });

        const validStatuses = ["active", "inactive", "draft"];
        if (!validStatuses.includes(rawStatus)) {
            return reply.code(400).send({ ok: false, message: "INVALID_STATUS" });
        }

        const dupSlug = await app.prisma.tenant.findFirst({ where: { slug } });
        if (dupSlug) {
            return reply.code(409).send({ ok: false, message: "SLUG_ALREADY_EXISTS" });
        }

        if (primaryDomain) {
            const dupDomain = await app.prisma.tenant.findFirst({ where: { primaryDomain } });
            if (dupDomain) {
                return reply.code(409).send({ ok: false, message: "PRIMARY_DOMAIN_ALREADY_EXISTS" });
            }
        }

        const themeJson = mergeOpenchatUrl(null, openchatUrl);

        const created = await app.prisma.tenant.create({
            data: {
                slug,
                name,
                status: rawStatus,
                primaryDomain: primaryDomain || null,
                timezone: "Asia/Seoul",
                themeJson,
            },
        });

        return reply.send({
            ok: true,
            tenant: {
                id: Number(created.id),
                slug: created.slug,
                name: created.name,
                status: created.status,
                primaryDomain: created.primaryDomain,
                timezone: created.timezone,
                openchatUrl: parseOpenchatUrl(created.themeJson),
            },
        });
    });

    // PUT 수정 — hq_super 전용. slug 변경 불가, status='inactive' = soft delete.
    app.put("/v1/seller/tenants/:id", async (req: any, reply) => {
        if (!(await requireHqSuper(app, req, reply))) return;

        const idRaw = String((req.params as any)?.id ?? "");
        if (!/^\d+$/.test(idRaw)) {
            return reply.code(400).send({ ok: false, message: "INVALID_ID" });
        }
        const id = BigInt(idRaw);

        const current = await app.prisma.tenant.findUnique({ where: { id } });
        if (!current) return reply.code(404).send({ ok: false, message: "TENANT_NOT_FOUND" });

        const body = (req.body ?? {}) as any;
        const data: any = {};

        if (body.name !== undefined) {
            const n = String(body.name).trim();
            if (!n) return reply.code(400).send({ ok: false, message: "NAME_REQUIRED" });
            data.name = n;
        }

        if (body.status !== undefined) {
            const s = String(body.status).trim();
            const validStatuses = ["active", "inactive", "draft"];
            if (!validStatuses.includes(s)) {
                return reply.code(400).send({ ok: false, message: "INVALID_STATUS" });
            }
            data.status = s;
        }

        if (body.primaryDomain !== undefined) {
            const d = String(body.primaryDomain).trim();
            if (d && d !== (current.primaryDomain ?? "")) {
                const dupDomain = await app.prisma.tenant.findFirst({
                    where: { primaryDomain: d, id: { not: id } },
                });
                if (dupDomain) {
                    return reply.code(409).send({ ok: false, message: "PRIMARY_DOMAIN_ALREADY_EXISTS" });
                }
            }
            data.primaryDomain = d || null;
        }

        if (body.openchatUrl !== undefined) {
            const openchatUrl = String(body.openchatUrl ?? "").trim();
            data.themeJson = mergeOpenchatUrl(current.themeJson ?? null, openchatUrl);
        }

        const updated = await app.prisma.tenant.update({ where: { id }, data });

        return reply.send({
            ok: true,
            tenant: {
                id: Number(updated.id),
                slug: updated.slug,
                name: updated.name,
                status: updated.status,
                primaryDomain: updated.primaryDomain,
                timezone: updated.timezone,
                openchatUrl: parseOpenchatUrl(updated.themeJson),
            },
        });
    });
}
