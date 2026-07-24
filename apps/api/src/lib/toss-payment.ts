// apps/api/src/lib/toss-payment.ts
// shop-php lib/toss_payment.php + toss_confirm.php API 호출부 포팅

import { createHash } from "node:crypto";

export type TossApiResult = {
    httpCode: number;
    body: string;
    data: Record<string, unknown>;
    curlError: string;
};

export function getTossSecretKey(): string {
    return String(process.env.TOSS_SECRET_KEY ?? "").trim();
}

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

function hashSha256(input: string): string {
    return createHash("sha256").update(input).digest("hex");
}

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

export function buildTossOrderId(): string {
    const rand = Math.floor(Math.random() * 900) + 100;
    return `ORDER-${Date.now()}-${rand}`;
}

export function isValidTossOrderId(orderId: string): boolean {
    return /^[A-Za-z0-9_-]{6,64}$/.test(orderId);
}

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
