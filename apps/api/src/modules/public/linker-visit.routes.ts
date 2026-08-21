/** POST /v1/public/linker/visit — 링커 스토어 유입 로그(미들웨어 fire-and-forget) */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
    logLinkerJourneyEvent,
    resolveLinkerIdBySlug,
} from "../attribution/journey-log.js";

type VisitBody = {
    slug?: string;
    sessionKey?: string;
};

export async function publicLinkerVisitRoutes(app: FastifyInstance) {
    app.post(
        "/v1/public/linker/visit",
        async (req: FastifyRequest<{ Body: VisitBody }>, reply: FastifyReply) => {
            try {
                const slug = String(req.body?.slug ?? "")
                    .trim()
                    .toLowerCase()
                    .slice(0, 64);
                if (!slug) {
                    return reply.code(400).send({ ok: false, message: "slug required" });
                }

                const linkerId = await resolveLinkerIdBySlug(app.prisma, slug);
                await logLinkerJourneyEvent(app.prisma, {
                    eventType: "visit",
                    linkerId,
                    landingSlug: slug,
                    sessionKey: req.body?.sessionKey ?? null,
                });

                return reply.send({ ok: true });
            } catch (error: unknown) {
                app.log.error(error, "LINKER_VISIT_LOG_ERROR");
                // 유입 로그 실패는 클라이언트에 에러로 드러내지 않는다.
                return reply.send({ ok: true, skipped: true });
            }
        }
    );
}
