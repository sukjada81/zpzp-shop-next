// apps/api/src/common/guard.ts
import type { FastifyReply, FastifyRequest } from "fastify";

function getSession(req: FastifyRequest): any {
    return (req as any).session;
}

function isLoggedIn(req: FastifyRequest): boolean {
    const s = getSession(req);
    return !!(s?.admin || s?.adminUserId || s?.user?.id);
}

function isSuperAdmin(req: FastifyRequest): boolean {
    const s = getSession(req);
    return !!(s?.admin?.is_super_admin || s?.user?.is_super_admin);
}

export type RequireAdminOptions = {
    /** 통합 관리자만 허용 */
    superOnly?: boolean;
};

/**
 * ✅ Admin 가드
 * - 사용 형태 1) preHandler: requireAdmin
 * - 사용 형태 2) app.addHook("preHandler", requireAdmin({ superOnly: true }))
 */
export function requireAdmin(
    opts?: RequireAdminOptions
): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
    return async (req: FastifyRequest, reply: FastifyReply) => {
        if (!isLoggedIn(req)) {
            reply.code(401).send({ ok: false, message: "ADMIN_UNAUTHORIZED" });
            return;
        }
        if (opts?.superOnly && !isSuperAdmin(req)) {
            reply.code(403).send({ ok: false, message: "ADMIN_FORBIDDEN" });
            return;
        }
    };
}

export type RequireTenantOptions = {
    /** tenantId 체크를 완화하고 싶을 때 */
    allowMissingTenant?: boolean;
};

/**
 * ✅ Tenant 가드 (public/seller 등에서 사용 가능)
 */
export function requireTenant(
    opts?: RequireTenantOptions
): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
    return async (req: FastifyRequest, reply: FastifyReply) => {
        const s = getSession(req);

        if (!isLoggedIn(req)) {
            reply.code(401).send({ ok: false, message: "UNAUTHORIZED" });
            return;
        }

        if (!opts?.allowMissingTenant) {
            if (!s?.tenantId && !s?.tenant?.id) {
                reply.code(403).send({ ok: false, message: "TENANT_FORBIDDEN" });
                return;
            }
        }
    };
}

/**
 * (옵션) 슈퍼관리자 전용 (별도 사용하고 싶을 때)
 */
export function requireSuperAdmin() {
    return requireAdmin({ superOnly: true });
}