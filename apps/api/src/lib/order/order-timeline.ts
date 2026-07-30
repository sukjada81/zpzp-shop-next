/**
 * 관리자 주문 상세 — 결제·상태·PG 취소 타임라인 조합.
 */

export type OrderTimelineEntry = {
    id: string;
    source: "audit" | "order_log" | "toss_cancel" | "toss_prepare";
    eventType: string;
    label: string;
    detail: string | null;
    orderGoodsUid: number | null;
    actor: string | null;
    amount: number | null;
    meta: Record<string, unknown> | null;
    at: string;
};

const GOODS_STATUS: Record<number, string> = {
    0: "입금대기",
    1: "결제완료",
    2: "배송준비",
    3: "배송중",
    4: "배송완료",
    5: "구매확정",
    7: "교환",
    8: "반품",
    9: "취소",
};

const STATUS2: Record<number, string> = {
    1: "요청",
    2: "중",
    3: "회수완료",
    4: "발송완료",
    5: "완료",
};

function formatGoodsStatus(status: number, status2: number): string {
    const base = GOODS_STATUS[status] ?? `status(${status})`;
    if (status2 > 0) {
        const sub = STATUS2[status2] ?? String(status2);
        return `${base}·${sub}`;
    }
    return base;
}

function auditEventLabel(eventType: string): string {
    switch (eventType) {
        case "payment_prepare":
            return "결제 준비";
        case "payment_confirm":
            return "결제 승인";
        case "cancel_full":
            return "전액 취소(PG)";
        case "cancel_partial":
            return "부분 취소(PG)";
        case "cancel_request":
            return "취소요청";
        case "cancel_withdraw":
            return "취소요청 철회";
        case "claim_request":
            return "교환·반품 요청";
        case "claim_withdraw":
            return "교환·반품 철회";
        case "confirm":
            return "구매확정";
        case "status_change":
            return "상태 변경";
        case "cancel":
            return "주문 취소";
        default:
            return eventType;
    }
}

function parseMetaJson(raw: string | null | undefined): Record<string, unknown> | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

function isoFromUnix(sec: number | null | undefined): string | null {
    if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
    return new Date(Math.trunc(sec) * 1000).toISOString();
}

export function buildOrderTimeline(input: {
    auditRows: Array<{
        uid: bigint | number;
        event_type: string;
        order_goods_uid: number | null;
        actor_role: string;
        actor_nickname: string;
        before_status: number | null;
        after_status: number | null;
        reason: string | null;
        meta_json: string | null;
        created_at: Date;
    }>;
    orderLogRows: Array<{
        uid: number;
        og_uid: number;
        id: string;
        prev_status: number;
        prev_status2: number;
        status: number;
        status2: number;
        signdate: number;
    }>;
    tossCancelRows: Array<{
        uid: bigint | number;
        order_goods_uid?: number | null;
        cancel_type: string;
        cancel_amount: number;
        cancel_reason: string;
        request_source: string;
        requested_by: string;
        result_status: string;
        toss_payment_status: string;
        refundable_amount: number;
        error_message: string;
        requested_at: Date;
    }>;
    tossPrepareRows: Array<{
        uid: number;
        amount: number;
        status: number;
        payment_status: string;
        payment_method: string;
        created_at: Date;
        updated_at: Date | null;
        approved_at: number;
    }>;
}): OrderTimelineEntry[] {
    const entries: OrderTimelineEntry[] = [];

    for (const row of input.tossPrepareRows) {
        const at =
            row.approved_at > 0
                ? isoFromUnix(row.approved_at)
                : row.updated_at?.toISOString() ?? row.created_at.toISOString();

        if (row.payment_status === "DONE" || row.status === 2) {
            entries.push({
                id: `prepare-confirm-${row.uid}`,
                source: "toss_prepare",
                eventType: "payment_confirm",
                label: "토스 결제 승인",
                detail: `${Number(row.amount).toLocaleString()}원 · ${row.payment_method || row.payment_status || "DONE"}`,
                orderGoodsUid: null,
                actor: "system",
                amount: Number(row.amount),
                meta: {
                    prepareUid: row.uid,
                    paymentStatus: row.payment_status,
                    paymentMethod: row.payment_method,
                },
                at: at ?? row.created_at.toISOString(),
            });
        } else {
            entries.push({
                id: `prepare-${row.uid}`,
                source: "toss_prepare",
                eventType: "payment_prepare",
                label: "토스 결제 준비",
                detail: `${Number(row.amount).toLocaleString()}원`,
                orderGoodsUid: null,
                actor: "system",
                amount: Number(row.amount),
                meta: { prepareUid: row.uid, status: row.status },
                at: row.created_at.toISOString(),
            });
        }
    }

    for (const row of input.tossCancelRows) {
        const ogUid =
            row.order_goods_uid != null && Number(row.order_goods_uid) > 0
                ? Number(row.order_goods_uid)
                : null;
        entries.push({
            id: `toss-cancel-${row.uid}`,
            source: "toss_cancel",
            eventType: row.cancel_type === "partial" ? "cancel_partial" : "cancel_full",
            label:
                row.cancel_type === "partial"
                    ? `토스 부분취소 (${row.result_status})`
                    : `토스 전액취소 (${row.result_status})`,
            detail: [
                `${Number(row.cancel_amount).toLocaleString()}원`,
                row.toss_payment_status ? `PG:${row.toss_payment_status}` : "",
                row.refundable_amount > 0
                    ? `잔여 ${Number(row.refundable_amount).toLocaleString()}원`
                    : "",
                row.error_message ? row.error_message : "",
            ]
                .filter(Boolean)
                .join(" · "),
            orderGoodsUid: ogUid,
            actor: `${row.request_source}/${row.requested_by}`,
            amount: Number(row.cancel_amount),
            meta: {
                logUid: Number(row.uid),
                cancelReason: row.cancel_reason,
                resultStatus: row.result_status,
            },
            at: row.requested_at.toISOString(),
        });
    }

    for (const row of input.orderLogRows) {
        entries.push({
            id: `order-log-${row.uid}`,
            source: "order_log",
            eventType: "status_change",
            label: "상품 상태 변경",
            detail: `${formatGoodsStatus(row.prev_status, row.prev_status2)} → ${formatGoodsStatus(row.status, row.status2)}`,
            orderGoodsUid: Number(row.og_uid) || null,
            actor: row.id || null,
            amount: null,
            meta: null,
            at: isoFromUnix(row.signdate) ?? new Date().toISOString(),
        });
    }

    for (const row of input.auditRows) {
        const meta = parseMetaJson(row.meta_json);
        const amount =
            meta && typeof meta.cancelAmount === "number" ? meta.cancelAmount : null;

        entries.push({
            id: `audit-${row.uid}`,
            source: "audit",
            eventType: row.event_type,
            label: auditEventLabel(row.event_type),
            detail: [
                row.before_status != null && row.after_status != null
                    ? `${formatGoodsStatus(row.before_status, 0)} → ${formatGoodsStatus(row.after_status, 0)}`
                    : "",
                row.reason ?? "",
                meta?.cancelType ? String(meta.cancelType) : "",
                amount != null ? `${amount.toLocaleString()}원` : "",
            ]
                .filter(Boolean)
                .join(" · "),
            orderGoodsUid: row.order_goods_uid,
            actor: `${row.actor_role}/${row.actor_nickname}`,
            amount,
            meta,
            at: row.created_at.toISOString(),
        });
    }

    entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return entries;
}
