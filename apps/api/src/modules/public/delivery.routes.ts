/**
 * 공개 배송비 API (1차)
 *
 * POST /v1/public/delivery/quote — 장바구니·주문서 금액 미리보기
 * GET  /v1/public/delivery/policy — 본사 배송 정책 문구(상품 상세 안내용)
 *
 * shop-php order_post.php 배송 루프의 shop-next 대응. 쿠폰은 상품합(subtotal) 기준으로 유지.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
    formatDeliveryPolicyLabel,
    formatProductDeliveryHint,
} from "../../lib/delivery/calculate-delivery.js";
import { loadShopDeliveryConfig } from "../../lib/delivery/delivery-config.js";
import { quoteOrderDelivery } from "../../lib/delivery/order-delivery.js";

const quoteBodySchema = z.object({
    items: z
        .array(
            z.object({
                productId: z.number().int().positive(),
                qty: z.number().int().positive(),
            })
        )
        .min(1),
});

type QuoteBody = z.infer<typeof quoteBodySchema>;

export async function publicDeliveryRoutes(app: FastifyInstance) {
    /** 본사 mallRN_configuration 기준 정책 문구 — 로그인 불필요 */
    app.get("/v1/public/delivery/policy", async (_req, reply: FastifyReply) => {
        try {
            const config = await loadShopDeliveryConfig(app.prisma);
            return reply.send({
                ok: true,
                policy: {
                    deliveryType: config.deliveryType,
                    freeThreshold: config.freeThreshold,
                    feeBelowThreshold: config.feeBelowThreshold,
                    label: formatDeliveryPolicyLabel(config),
                },
            });
        } catch (error: unknown) {
            app.log.error(error, "DELIVERY_POLICY_ERROR");
            return reply.code(500).send({
                ok: false,
                message: "배송 정책을 불러올 수 없습니다.",
            });
        }
    });

    /**
     * 품목별 qty 기준 배송비 quote
     * - subtotal: 상품합(쿠폰 기준 금액)
     * - deliveryTotal: 본사 type=1·P 정책 배송비
     * - payTotalHint: subtotal + deliveryTotal (쿠폰·할인 전)
     */
    app.post(
        "/v1/public/delivery/quote",
        async (
            req: FastifyRequest<{ Body: QuoteBody }>,
            reply: FastifyReply
        ) => {
            try {
                const parsed = quoteBodySchema.safeParse(req.body ?? {});
                if (!parsed.success) {
                    return reply.code(400).send({
                        ok: false,
                        message: "주문 상품 정보가 올바르지 않습니다.",
                    });
                }

                const quoted = await quoteOrderDelivery(app.prisma, parsed.data.items);
                if (!quoted.ok) {
                    return reply.code(400).send({
                        ok: false,
                        message: quoted.message,
                    });
                }

                const config = await loadShopDeliveryConfig(app.prisma);
                const { quote } = quoted;

                return reply.send({
                    ok: true,
                    subtotal: quote.subtotal,
                    deliveryTotal: quote.deliveryTotal,
                    conditionalSubtotal: quote.conditionalSubtotal,
                    payTotalHint: quote.subtotal + quote.deliveryTotal,
                    policyLabel: formatDeliveryPolicyLabel(config),
                });
            } catch (error: unknown) {
                app.log.error(error, "DELIVERY_QUOTE_ERROR");
                return reply.code(500).send({
                    ok: false,
                    message: "배송비 계산 중 오류가 발생했습니다.",
                });
            }
        }
    );

    /**
     * 상품 uid + delivery_type 으로 안내 문구 (상품 API 와 동일 로직 공유용)
     * GET /v1/public/delivery/product-hint?deliveryType=1
     */
    app.get(
        "/v1/public/delivery/product-hint",
        async (
            req: FastifyRequest<{ Querystring: { deliveryType?: string } }>,
            reply: FastifyReply
        ) => {
            try {
                const deliveryType = Number(req.query?.deliveryType ?? 1);
                const config = await loadShopDeliveryConfig(app.prisma);
                return reply.send({
                    ok: true,
                    label: formatProductDeliveryHint(
                        Number.isFinite(deliveryType) ? deliveryType : 1,
                        config
                    ),
                });
            } catch (error: unknown) {
                app.log.error(error, "DELIVERY_PRODUCT_HINT_ERROR");
                return reply.code(500).send({
                    ok: false,
                    message: "배송 안내를 불러올 수 없습니다.",
                });
            }
        }
    );
}
