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
    // 케이스 혼재 대응
    return !!(s?.admin?.isSuperAdmin || s?.admin?.is_super_admin || s?.user?.is_super_admin);
}

export type RequireAdminOptions = {
    /** 통합 관리자만 허용 */
    superOnly?: boolean;
};

/**
 * ✅ Admin 가드
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
    /** 특정 라우트에서 tenant 없이도 허용하고 싶을 때 */
    allowMissingTenant?: boolean;
};

/**
 * ✅ Tenant 가드 (PUBLIC)
 * - 로그인 여부 체크 ❌
 * - tenantPlugin이 채워준 request.tenantId / tenantSlug 기준으로 체크 ✅
 */
export function requireTenant(
    opts?: RequireTenantOptions
): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
    return async (req: FastifyRequest, reply: FastifyReply) => {
        if (opts?.allowMissingTenant) return;

        const url = String(req.raw?.url || req.url || "");

        // ✅ 핵심: auth API는 tenant 검사 제외
        if (
            url.startsWith("/v1/auth/") ||
            url === "/v1/auth" ||
            url.startsWith("/health")
        ) {
            return;
        }

        const tenantId = (req as any).tenantId as bigint | null | undefined;
        const tenantSlug = (req as any).tenantSlug as string | null | undefined;

        if (!tenantId || !tenantSlug) {
            reply.code(400).send({ ok: false, message: "TENANT_NOT_RESOLVED" });
            return;
        }
    };
}

/**
 * (옵션) 슈퍼관리자 전용
 */
export function requireSuperAdmin() {
    return requireAdmin({ superOnly: true });
}