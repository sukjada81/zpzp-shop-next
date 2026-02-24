import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * MVP guard:
 * - 아직 세션/토큰 인증 전이므로, 일단 "관리자 키" 같은 임시 방식을 두지 않고
 *   public API만 먼저 열어두는 게 안전합니다.
 * - admin API는 Phase 4(인증)에서 붙입니다.
 *
 * 필요 시 임시로 header 기반 관리자 인증을 추가할 수 있음:
 *   X-Admin-Key: ...
 */
export function requireTenant(req: FastifyRequest, reply: FastifyReply) {
    if (!req.tenantId) {
        reply.code(400).send({ ok: false, error: "TENANT_NOT_RESOLVED" });
        return false;
    }
    return true;
}