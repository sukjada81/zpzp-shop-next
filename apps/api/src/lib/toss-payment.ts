/**
 * Toss Payments API 공통 유틸
 *
 * shop-php `lib/toss_payment.php`, `php/toss_confirm.php` 의 API 호출부를 TypeScript로 포팅.
 * 셀러 스토어프론트(shop-next)와 본사몰(shop-php)이 동일 PG 키·동일 b2bdb 를 쓴다.
 *
 * 환경변수 (apps/api/.env):
 *   TOSS_CLIENT_KEY — 프론트 결제창 SDK용 (client-key API에서 노출)
 *   TOSS_SECRET_KEY — 서버 confirm/cancel API용 (절대 프론트 노출 금지)
 */

import { createHash } from "node:crypto";

/** Toss API 호출 결과 (shop-php toss_api_post 반환 형태와 동일) */
export type TossApiResult = {
    httpCode: number;
    body: string;
    data: Record<string, unknown>;
    curlError: string;
};

/** 서버 전용 시크릿 키 — confirm/cancel API Authorization 헤더에 사용 */
export function getTossSecretKey(): string {
    return String(process.env.TOSS_SECRET_KEY ?? "").trim();
}

/** 클라이언트 키 — GET /v1/payments/toss/client-key 로 프론트에 전달 */
export function getTossClientKey(): string {
    return String(process.env.TOSS_CLIENT_KEY ?? "").trim();
}

export function tossJsonEncode(value: unknown): string {
    try {
        return JSON.stringify(value ?? {});
    } catch {
        return "{}";
    }
}

/** Idempotency-Key 생성용 — 동일 결제 재시도 시 Toss 중복 승인 방지 */
function hashSha256(input: string): string {
    return createHash("sha256").update(input).digest("hex");
}

/**
 * Toss REST API POST 공통 호출
 * - Authorization: Basic base64(secretKey + ':')
 * - Idempotency-Key: 멱등성 보장 (confirm/cancel 각각 고유 키)
 */
export async function tossApiPost(
    url: string,
    body: Record<string, unknown>,
    secretKey: string,
    idempotencyKey: string
): Promise<TossApiResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
                "Content-Type": "application/json",
                "Idempotency-Key": idempotencyKey,
            },
            body: tossJsonEncode(body),
            signal: controller.signal,
        });

        const bodyText = await res.text();
        let data: Record<string, unknown> = {};
        try {
            const parsed = JSON.parse(bodyText);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                data = parsed as Record<string, unknown>;
            }
        } catch {
            data = {};
        }

        return {
            httpCode: res.status,
            body: bodyText,
            data,
            curlError: "",
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            httpCode: 0,
            body: "",
            data: {},
            curlError: message,
        };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * 전액 취소 성공 여부 판정 (shop-php toss_cancel_succeeded 와 동일)
 * - status=CANCELED, balanceAmount=0, 마지막 cancelStatus=DONE
 */
export function tossCancelSucceeded(apiResult: TossApiResult): boolean {
    if (apiResult.httpCode < 200 || apiResult.httpCode >= 300) return false;

    const data = apiResult.data;
    if (String(data.status ?? "").toUpperCase() !== "CANCELED") return false;
    if (Number(data.balanceAmount ?? -1) !== 0) return false;

    const cancels = Array.isArray(data.cancels) ? data.cancels : [];
    if (!cancels.length) return false;

    const lastCancel = cancels[cancels.length - 1] as Record<string, unknown>;
    return String(lastCancel.cancelStatus ?? "").toUpperCase() === "DONE";
}

/** Toss confirm 응답 method → mallRN_order_info.pay_method 저장용 코드 */
export function normalizeTossMethod(raw: string): string {
    const value = String(raw ?? "").trim();
    if (!value) return "UNKNOWN";
    if (value === "계좌이체") return "TRANSFER";
    if (["카드", "신용카드", "체크카드", "신용/체크카드"].includes(value)) return "CARD";
    if (["휴대폰", "휴대폰결제"].includes(value)) return "MOBILE_PHONE";
    if (value === "가상계좌") return "VIRTUAL_ACCOUNT";
    if (["상품권", "문화상품권", "도서문화상품권"].includes(value)) return "GIFT_CERTIFICATE";

    const token = value.replace(/[\s\-_]/g, "").toUpperCase();
    if (["CARD", "CREDITCARD"].includes(token)) return "CARD";
    if (["TRANSFER", "ACCOUNTTRANSFER", "REALTIMEACCOUNTTRANSFER"].includes(token)) {
        return "TRANSFER";
    }
    if (["MOBILEPHONE", "MOBILE", "PHONE"].includes(token)) return "MOBILE_PHONE";
    if (token === "VIRTUALACCOUNT") return "VIRTUAL_ACCOUNT";
    if (["EASYPAY", "EASYPAYMENT", "EASYPAYMENTS"].includes(token)) return "EASY_PAY";
    return token;
}

/** 간편결제 provider → pay_info 세 번째 필드 (TOSS|METHOD|PROVIDER) */
export function normalizeTossProvider(raw: string): string {
    const token = String(raw ?? "")
        .trim()
        .replace(/[\s\-_]/g, "")
        .toUpperCase();
    if (!token) return "";
    if (token === "KAKAOPAY") return "KAKAOPAY";
    if (token === "NAVERPAY") return "NAVERPAY";
    if (token === "PAYCO") return "PAYCO";
    if (["TOSSPAY", "TOSS", "TOSSPAYMENTS", "TOSSPAYPAY"].includes(token)) return "TOSSPAY";
    return token;
}

/** prepare 단계에서 생성하는 Toss orderId (mallRN_toss_prepare.order_id) */
export function buildTossOrderId(): string {
    const rand = Math.floor(Math.random() * 900) + 100;
    return `ORDER-${Date.now()}-${rand}`;
}

export function isValidTossOrderId(orderId: string): boolean {
    return /^[A-Za-z0-9_-]{6,64}$/.test(orderId);
}

/** POST /v1/payments/confirm — 결제창 successUrl 콜백 후 서버에서 승인 확정 */
export async function tossConfirmPayment(
    secretKey: string,
    paymentKey: string,
    orderId: string,
    amount: number
): Promise<TossApiResult> {
    return tossApiPost(
        "https://api.tosspayments.com/v1/payments/confirm",
        { paymentKey, orderId, amount },
        secretKey,
        `confirm-${hashSha256(`${orderId}:${paymentKey}`)}`
    );
}

/**
 * POST /v1/payments/{paymentKey}/cancel — 전액 취소
 * 주문 생성 실패 시 자동 취소, (향후) 고객/관리자 취소 API에서도 사용 예정
 */
export async function tossCancelPaymentFull(
    secretKey: string,
    paymentKey: string,
    orderId: string,
    cancelReason: string
): Promise<TossApiResult> {
    return tossApiPost(
        `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`,
        { cancelReason },
        secretKey,
        `auto-cancel-${hashSha256(`${orderId}:${paymentKey}`)}`
    );
}
