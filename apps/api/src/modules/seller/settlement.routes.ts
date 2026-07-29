// apps/api/src/modules/seller/settlement.routes.ts
// 링커 콘솔 정산 — 잔액/정산정보/출금 신청/취소.
// 정산 로직(유형별 검증·암호화·상태전이)은 shop-php lib/settlement_payout.php 단일 진실원이라
// 여기서는 세션으로 링커를 확정하고 브리지에 넘기기만 한다. 규칙 재구현 금지.
// 설계: shop-php docs/superpowers/specs/2026-07-29-linker-console-settlement-design.md
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireTenant } from "../../common/guard.js";
import { callPhpBridge } from "../../lib/php-bridge.js";
import { getLinker } from "./linker.js";

const BRIDGE_PATH = "/php/settlement_api.php";

/** 정산정보 입력. 값 검증은 PHP 헬퍼가 하므로 여기서는 형태만 본다(문구 이원화 방지). */
const profileSchema = z.object({
    business_type: z.string().default(""),
    resident_number: z.string().optional(),
    corp_number: z.string().optional(),
    business_number: z.string().optional(),
    company_name_sole: z.string().optional(),
    company_name_corp: z.string().optional(),
    bank_name: z.string().optional(),
    account_number: z.string().optional(),
    account_holder: z.string().optional(),
});

const cancelSchema = z.object({
    req_uid: z.coerce.number().int().positive(),
});

export async function sellerSettlementRoutes(app: FastifyInstance) {
    /** 링커 확정 + 브리지 호출 + 응답 변환을 한 곳에 모은다. */
    async function handle(req: any, reply: any, action: string, extra: Record<string, unknown> = {}) {
        const linker = await getLinker(app, req);
        if (!linker) {
            return reply.code(403).send({ ok: false, message: "링커 승인 회원만 이용할 수 있습니다.", data: null });
        }

        // linker_id 는 넘기지 않는다 — PHP 가 member_uid 로 다시 조회해 스스로 확인한다.
        const result = await callPhpBridge(BRIDGE_PATH, {
            action,
            member_uid: linker.member_uid,
            ...extra,
        });

        if (result.transportFailed) {
            req.log?.error({ action, status: result.status }, "settlement bridge unreachable");
            return reply.code(502).send({ ok: false, message: result.message, data: null });
        }

        // 헬퍼가 돌려준 한국어 메시지를 그대로 전달한다(본사몰 화면과 같은 문구 유지).
        return reply.code(result.status && result.status >= 500 ? 502 : 200).send({
            ok: result.ok,
            message: result.message,
            data: result.data,
        });
    }

    app.get("/v1/seller/settlement", { preHandler: requireTenant() }, async (req, reply) => {
        return handle(req, reply, "summary");
    });

    app.post("/v1/seller/settlement/profile", { preHandler: requireTenant() }, async (req, reply) => {
        const parsed = profileSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return reply.code(400).send({ ok: false, message: "입력값을 확인해 주세요.", data: null });
        }
        return handle(req, reply, "save_profile", parsed.data);
    });

    app.post("/v1/seller/settlement/request", { preHandler: requireTenant() }, async (req, reply) => {
        return handle(req, reply, "request");
    });

    app.post("/v1/seller/settlement/cancel", { preHandler: requireTenant() }, async (req, reply) => {
        const parsed = cancelSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return reply.code(400).send({ ok: false, message: "취소할 신청을 찾을 수 없습니다.", data: null });
        }
        return handle(req, reply, "cancel", { req_uid: parsed.data.req_uid });
    });
}
