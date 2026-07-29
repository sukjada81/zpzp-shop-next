/**
 * 고객/관리자 주문 취소 시 Toss PG 전액 취소 (shop-php zpzpTossCancelPayment full 취소 대응)
 */
import type { PrismaClient } from "@prisma/client";
import {
    getTossSecretKey,
    tossCancelPaymentFull,
    tossCancelSucceeded,
    tossJsonEncode,
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

/** 온라인 선결제 주문 — PG 전액 취소. 성공·이미취소만 ok=true */
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

    const idempotencySeed = `${orderId}|${requestKey}|full|0`;
    const apiResult = await tossCancelPaymentFull(
        secretKey,
        paymentKey,
        orderId,
        cancelReason,
        idempotencySeed
    );
    const cancelOk = tossCancelSucceeded(apiResult);

    if (!cancelOk) {
        const tossMessage =
            typeof apiResult.data?.message === "string"
                ? apiResult.data.message
                : apiResult.curlError || "결제 취소에 실패했습니다.";

        return {
            ok: false,
            code: "TOSS_CANCEL_FAILED",
            message: tossMessage,
        };
    }

    const now = toUnixNow();
    await prisma.mallRN_toss_prepare.update({
        where: { uid: prepare.uid },
        data: {
            status: 7,
            payment_status: "CANCELED",
            payload: tossJsonEncode({
                event: "CUSTOMER_ORDER_CANCEL",
                requestKey,
                requestSource,
                requestedBy,
                cancelReason,
                httpCode: apiResult.httpCode,
            }),
            signdate: now,
            updated_at: new Date(),
        },
    });

    return { ok: true, canceled: true };
}
