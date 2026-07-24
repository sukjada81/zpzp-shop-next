// src/lib/toss/client.ts

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

export async function initTossPayment(tenant: string) {
    await loadTossSdk();
    const clientKey = await fetchTossClientKey(tenant);

    if (typeof window.TossPayments !== "function") {
        throw new Error("토스 결제 SDK를 불러오지 못했습니다.");
    }

    const tossPayments = window.TossPayments(clientKey);
    const anonymousKey =
        (window.TossPayments as unknown as { ANONYMOUS?: string }).ANONYMOUS ?? "ANONYMOUS";

    return tossPayments.payment({ customerKey: anonymousKey });
}

export function resetTossClientKeyCache() {
    clientKeyPromise = null;
}
