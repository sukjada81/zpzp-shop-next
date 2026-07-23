/**
 * Toss Payments v2 SDK 브라우저 헬퍼
 *
 * shop-php skin/seriesWhite/order.html 의 initTossPaymentIfNeeded / loadTossClientKey 포팅.
 * clientKey 는 API 프록시를 통해 서버에서 받음 (env 직접 노출 방지).
 */

declare global {
    interface Window {
        TossPayments?: (clientKey: string) => {
            payment: (options: { customerKey: string }) => {
                requestPayment: (params: Record<string, unknown>) => Promise<void>;
            };
        };
    }
}

const TOSS_SDK_URL = "https://js.tosspayments.com/v2/standard";

let sdkPromise: Promise<void> | null = null;
let clientKeyPromise: Promise<string> | null = null;

/** Toss v2 standard SDK script 동적 로드 (중복 삽입 방지) */
function loadScript(src: string): Promise<void> {
    if (typeof window === "undefined") {
        return Promise.reject(new Error("browser only"));
    }

    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("토스 결제 SDK를 불러오지 못했습니다."));
        document.head.appendChild(script);
    });
}

export async function loadTossSdk(): Promise<void> {
    if (!sdkPromise) {
        sdkPromise = loadScript(TOSS_SDK_URL);
    }
    await sdkPromise;
}

/** GET /v1/payments/toss/client-key — 페이지당 1회 캐시 */
export async function fetchTossClientKey(tenant: string): Promise<string> {
    if (!clientKeyPromise) {
        clientKeyPromise = fetch(`/api/proxy/${tenant}/v1/payments/toss/client-key`, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data?.clientKey) {
                    throw new Error(data?.message || "토스 클라이언트 키를 불러오지 못했습니다.");
                }
                return String(data.clientKey);
            })
            .catch((error) => {
                clientKeyPromise = null;
                throw error;
            });
    }
    return clientKeyPromise;
}

/** SDK + clientKey 준비 후 requestPayment 호출 가능한 payment 객체 반환 */
export async function initTossPayment(tenant: string) {
    await loadTossSdk();
    const clientKey = await fetchTossClientKey(tenant);

    if (typeof window.TossPayments !== "function") {
        throw new Error("토스 결제 SDK를 불러오지 못했습니다.");
    }

    const tossPayments = window.TossPayments(clientKey);
    // 비회원/간편 결제 — Toss ANONYMOUS customerKey (shop-php 와 동일)
    const anonymousKey =
        (window.TossPayments as unknown as { ANONYMOUS?: string }).ANONYMOUS ?? "ANONYMOUS";

    return tossPayments.payment({ customerKey: anonymousKey });
}

export function resetTossClientKeyCache() {
    clientKeyPromise = null;
}
