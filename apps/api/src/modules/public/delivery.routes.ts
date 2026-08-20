/**
 * POST /v1/public/delivery/quote — 주문서 배송비 미리보기 전용
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { calcHqDeliveryTotal } from "../../lib/delivery/hq-delivery.js";

const bodySchema = z.object({
    items: z
        .array(
            z.object({
                productId: z.number().int().positive(),
                qty: z.number().int().positive(),
            })
        )
        .min(1),
});

export async function publicDeliveryRoutes(app: FastifyInstance) {
    app.post(
        "/v1/public/delivery/quote",
        async (req: FastifyRequest, reply: FastifyReply) => {
            try {
                const parsed = bodySchema.safeParse(req.body ?? {});
                if (!parsed.success) {
                    return reply.code(400).send({ ok: false, message: "주문 상품이 올바르지 않습니다." });
                }
                const deliveryTotal = await calcHqDeliveryTotal(app.prisma, parsed.data.items);
                return reply.send({ ok: true, deliveryTotal });
            } catch (error: unknown) {
                app.log.error(error, "DELIVERY_QUOTE_ERROR");
                return reply.code(500).send({ ok: false, message: "배송비 계산 중 오류가 발생했습니다." });
            }
        }
    );
}
