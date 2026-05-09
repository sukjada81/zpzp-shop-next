// apps/api/src/modules/public/member.routes.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireTenant } from "../../common/guard.js";

function getSessionMemberUid(req: any): number | null {
    const member = req.session?.member as { uid?: string | number } | undefined;
    if (!member?.uid) return null;
    const n = Number(member.uid);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

export async function publicMemberRoutes(app: FastifyInstance) {
    app.get(
        "/v1/public/member/check-nickname",
        { preHandler: requireTenant() },
        async (req: any, reply) => {
            const tenantId = req.tenantId as bigint;

            const query = z
                .object({ nickname: z.string().min(1).max(50) })
                .safeParse(req.query ?? {});

            if (!query.success) {
                return reply.send({ ok: true, exists: false });
            }

            const nickname = query.data.nickname.trim();
            if (!nickname) {
                return reply.send({ ok: true, exists: false });
            }

            const member = await app.prisma.mallRN_member.findFirst({
                where: {
                    name: nickname,
                    mallRN_member_membership: {
                        some: {
                            scope_type: "tenant",
                            scope_id: tenantId,
                            status: "active",
                        },
                    },
                },
                select: { uid: true },
            });

            return reply.send({ ok: true, exists: !!member });
        }
    );

    app.patch(
        "/v1/public/member/reference",
        { preHandler: requireTenant() },
        async (req: any, reply) => {
            const memberUid = getSessionMemberUid(req);
            if (!memberUid) {
                return reply.code(401).send({ ok: false, message: "login required" });
            }

            const body = z
                .object({ reference: z.string().max(50) })
                .safeParse(req.body ?? {});

            if (!body.success) {
                return reply.code(400).send({ ok: false, message: "invalid body" });
            }

            await app.prisma.mallRN_member.update({
                where: { uid: memberUid },
                data: { reference: body.data.reference.trim() },
            });

            return reply.send({ ok: true });
        }
    );
}
