/**
 * 주문·결제·취소 감사 로그 — dad_order_action_log 단일 기록점.
 * mallRN_order_log(레거시) / mallRN_toss_cancel_log(PG)와 함께 admin 타임라인에 노출한다.
 */

export type OrderAuditEventType =
    | "payment_prepare"
    | "payment_confirm"
    | "cancel_full"
    | "cancel_partial"
    | "cancel_request"
    | "cancel_withdraw"
    | "claim_request"
    | "claim_withdraw"
    | "confirm"
    | "status_change"
    | "cancel";

export type OrderAuditLogInput = {
    tenantId: bigint;
    eventType: OrderAuditEventType;
    orderNum: string;
    orderGoodsUid?: number | null;
    actorRole: "member" | "guest" | "seller" | "admin" | "hq" | "system";
    actorMemberUid?: bigint | number | null;
    actorNickname: string;
    beforeStatus?: number | null;
    afterStatus?: number | null;
    beforeStatus2?: number | null;
    afterStatus2?: number | null;
    reason?: string | null;
    metaJson?: Record<string, unknown> | null;
};

type AuditLogClient = {
    dad_order_action_log: {
        create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    };
};

export async function writeOrderAuditLog(
    client: AuditLogClient,
    input: OrderAuditLogInput
): Promise<void> {
    const meta =
        input.metaJson && Object.keys(input.metaJson).length > 0
            ? JSON.stringify(input.metaJson)
            : null;

    await client.dad_order_action_log.create({
        data: {
            tenant_id: input.tenantId,
            event_type: input.eventType,
            order_num: input.orderNum,
            order_goods_uid: input.orderGoodsUid ?? null,
            actor_role: input.actorRole,
            actor_member_uid:
                input.actorMemberUid != null
                    ? BigInt(String(input.actorMemberUid))
                    : null,
            actor_nickname: String(input.actorNickname ?? "").slice(0, 100),
            before_status: input.beforeStatus ?? null,
            after_status: input.afterStatus ?? null,
            reason: input.reason ?? null,
            meta_json: meta,
        },
    });
}
