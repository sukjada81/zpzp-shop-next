/**
 * 고객/관리자 주문 취소 시 Toss PG 취소 (shop-php zpzpTossCancelPayment 대응)
 *
 * 2026-08-20
 * 부분 상품 취소 후 "전체 주문 취소" 시:
 * - PG는 잔액 취소에 성공했는데 Node가 CANCELED 만 성공으로 봐 DB가 안 바뀌던 문제
 * - 이미 취소된 결제에 전액취소를 다시 보내 실패로 보이던 문제
 * 를 막기 위해 조회(GET) → 남은 금액이면 부분취소 → 실패 시 한 번 더 조회로 맞춘다.
 */
import type { PrismaClient } from "@prisma/client";
import {
    getTossSecretKey,
    tossCancelPaymentFull,
    tossCancelPaymentPartial,
    tossCancelSucceeded,
    tossGetPayment,
    tossJsonEncode,
    tossPaymentFullyCanceled,
    type TossApiResult,
} from "./toss-payment.js";

export type TossOrderCancelResult =
    | { ok: true; skipped: true; reason: "already_canceled" }
    | { ok: true; canceled: true; duplicate?: boolean }
    | { ok: false; code: string; message: string };

type CancelTossOrderPaymentInput = {
    orderNum: string;
    cancelReason: string;
    requestKey: string;
    requestSource: string;
    requestedBy: string;
};

function toUnixNow(): number {
    return Math.floor(Date.now() / 1000);
}

function limitText(value: string, max: number): string {
    const trimmed = String(value ?? "").trim();
    if (trimmed.length <= max) return trimmed;
    return trimmed.slice(0, max);
}

function tossFailMessage(apiResult: TossApiResult): string {
    if (typeof apiResult.data?.message === "string" && apiResult.data.message.trim()) {
        return apiResult.data.message;
    }
    return apiResult.curlError || "결제 취소에 실패했습니다.";
}

async function markPrepareCanceled(
    prisma: PrismaClient,
    prepareUid: number,
    payload: Record<string, unknown>
) {
    const now = toUnixNow();
    await prisma.mallRN_toss_prepare.update({
        where: { uid: prepareUid },
        data: {
            status: 7,
            payment_status: "CANCELED",
            payload: tossJsonEncode(payload),
            signdate: now,
            updated_at: new Date(),
        },
    });
}

/** 2026-08-20 취소 API 실패 시 PG 실상태를 한 번 조회해 잔액 0이면 성공으로 본다. */
async function reconcileFromTossLookup(
    secretKey: string,
    paymentKey: string
): Promise<{ ok: true } | { ok: false }> {
    const lookup = await tossGetPayment(secretKey, paymentKey);
    if (lookup.httpCode >= 200 && lookup.httpCode < 300 && tossPaymentFullyCanceled(lookup.data)) {
        return { ok: true };
    }
    return { ok: false };
}

/** 온라인 선결제 주문 — 남은 금액까지 PG 취소. 성공·이미취소만 ok=true */
export async function cancelTossPaymentForOrder(
    prisma: PrismaClient,
    input: CancelTossOrderPaymentInput
): Promise<TossOrderCancelResult> {
    const orderNum = limitText(input.orderNum, 40);
    const cancelReason = limitText(input.cancelReason || "고객 주문 취소", 200);
    const requestKey = limitText(input.requestKey, 120);
    const requestSource = limitText(input.requestSource || "customer", 32);
    const requestedBy = limitText(input.requestedBy, 80);

    if (!orderNum || !requestKey) {
        return {
            ok: false,
            code: "INVALID_CANCEL_REQUEST",
            message: "결제 취소 요청 정보가 올바르지 않습니다.",
        };
    }

    const secretKey = getTossSecretKey();
    if (!secretKey) {
        return {
            ok: false,
            code: "TOSS_SECRET_KEY_REQUIRED",
            message: "결제 취소 설정을 확인할 수 없습니다.",
        };
    }

    const prepare = await prisma.mallRN_toss_prepare.findFirst({
        where: {
            order_num: orderNum,
            NOT: { payment_key: "" },
        },
        orderBy: { uid: "desc" },
    });

    if (!prepare) {
        return {
            ok: false,
            code: "TOSS_PREPARE_NOT_FOUND",
            message: "온라인 결제 정보를 찾을 수 없어 취소할 수 없습니다.",
        };
    }

    const paymentKey = String(prepare.payment_key ?? "").trim();
    const orderId = String(prepare.order_id ?? "").trim();
    if (!paymentKey || !orderId) {
        return {
            ok: false,
            code: "TOSS_PAYMENT_DATA_MISSING",
            message: "온라인 결제 승인 정보가 누락되어 취소할 수 없습니다.",
        };
    }

    const paymentStatus = String(prepare.payment_status ?? "").toUpperCase();
    if (paymentStatus === "CANCELED" || prepare.status === 7) {
        return { ok: true, skipped: true, reason: "already_canceled" };
    }

    // 2026-08-20: 부분취소 이력(PARTIAL_CANCELED)이 있으면 잔액을 조회한 뒤 그 금액만 취소한다.
    const lookup = await tossGetPayment(secretKey, paymentKey);
    if (lookup.httpCode >= 200 && lookup.httpCode < 300) {
        if (tossPaymentFullyCanceled(lookup.data)) {
            await markPrepareCanceled(prisma, prepare.uid, {
                event: "CUSTOMER_ORDER_CANCEL",
                requestKey,
                requestSource,
                requestedBy,
                cancelReason,
                syncedFrom: "toss_get_already_canceled",
            });
            return { ok: true, skipped: true, reason: "already_canceled" };
        }
    }

    const remaining = Number(lookup.data?.balanceAmount ?? 0);
    const usePartialRemaining =
        lookup.httpCode >= 200 &&
        lookup.httpCode < 300 &&
        remaining > 0 &&
        String(lookup.data?.status ?? "").toUpperCase() === "PARTIAL_CANCELED";

    let apiResult: TossApiResult;
    let cancelType: "full" | "partial" = "full";

    if (usePartialRemaining) {
        cancelType = "partial";
        const idempotencySeed = `${orderId}|${requestKey}|partial|${remaining}`;
        apiResult = await tossCancelPaymentPartial(
            secretKey,
            paymentKey,
            orderId,
            cancelReason,
            remaining,
            idempotencySeed
        );
    } else {
        const idempotencySeed = `${orderId}|${requestKey}|full|0`;
        apiResult = await tossCancelPaymentFull(
            secretKey,
            paymentKey,
            orderId,
            cancelReason,
            idempotencySeed
        );
    }

    let cancelOk = tossCancelSucceeded(apiResult, cancelType);

    // 2026-08-20: API 실패여도 PG 잔액이 0이면 성공으로 본다 (조회 1회).
    if (!cancelOk) {
        const reconciled = await reconcileFromTossLookup(secretKey, paymentKey);
        cancelOk = reconciled.ok;
    }

    if (!cancelOk) {
        return {
            ok: false,
            code: "TOSS_CANCEL_FAILED",
            message: tossFailMessage(apiResult),
        };
    }

    await markPrepareCanceled(prisma, prepare.uid, {
        event: "CUSTOMER_ORDER_CANCEL",
        requestKey,
        requestSource,
        requestedBy,
        cancelReason,
        httpCode: apiResult.httpCode,
        cancelType,
        remainingBefore: remaining,
    });

    return { ok: true, canceled: true };
}
