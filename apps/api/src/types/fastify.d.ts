// apps/api/src/types/fastify.d.ts
import "fastify";

declare module "fastify" {
    interface FastifyRequest {
        /**
         * 테넌트 슬러그 (예: "a", "b")
         * - tenant plugin 또는 라우트에서 세팅
         */
        tenantSlug?: string | null;

        /**
         * 테넌트 PK (DB)
         * - 필요 시 guard/프리핸들러에서 lookup해서 세팅
         */
        tenantId?: bigint | null;
    }
}