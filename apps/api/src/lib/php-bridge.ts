// apps/api/src/lib/php-bridge.ts
// shop-php 내부 JSON 브리지 호출(HMAC 서명). 정산 로직은 PHP 단일 진실원이므로
// 검증·암호화는 여기서 하지 않고 그대로 넘긴다.
// 상대편: shop-php php/settlement_api.php + lib/internal_auth.php
// 설계: shop-php docs/superpowers/specs/2026-07-29-linker-console-settlement-design.md
import { createHmac, timingSafeEqual } from "node:crypto";

/** 내부 vhost. 공개 vhost는 https 로 301 하므로 루프백 전용 포트를 쓴다. */
function bridgeOrigin() {
    return (process.env.PHP_BRIDGE_ORIGIN || "http://127.0.0.1:8081").replace(/\/+$/, "");
}

function bridgeSecret() {
    const secret = String(process.env.ZPZP_INTERNAL_SECRET || "");
    if (secret.length < 32) {
        throw new Error("ZPZP_INTERNAL_SECRET is missing or too short (min 32 chars).");
    }
    return secret;
}

export type BridgeResult<T = unknown> = {
    ok: boolean;
    message: string;
    data: T | null;
    /** 브리지 도달 실패(네트워크/형식) 여부 — 호출자가 502 로 묶기 위한 구분. */
    transportFailed?: boolean;
    status?: number;
};

/**
 * PHP 브리지 호출. 서명 대상은 "타임스탬프\n원문바디"로 PHP zpzpInternalSign 과 동일하다.
 * body 에는 민감정보가 실릴 수 있으므로 어떤 경우에도 로그로 남기지 않는다.
 */
export async function callPhpBridge<T = unknown>(
    scriptPath: string,
    payload: Record<string, unknown>,
    timeoutMs = 10_000,
): Promise<BridgeResult<T>> {
    let body: string;
    let sign: string;
    const ts = Math.floor(Date.now() / 1000).toString();

    try {
        body = JSON.stringify(payload);
        sign = createHmac("sha256", bridgeSecret()).update(`${ts}\n${body}`).digest("hex");
    } catch {
        return { ok: false, message: "정산 서버 설정이 올바르지 않습니다.", data: null, transportFailed: true };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(new URL(scriptPath, bridgeOrigin()), {
            method: "POST",
            headers: {
                "content-type": "application/json",
                accept: "application/json",
                "x-zpzp-ts": ts,
                "x-zpzp-sign": sign,
            },
            body,
            signal: controller.signal,
        });

        const parsed = (await res.json().catch(() => null)) as
            | { ok?: boolean; message?: string; data?: T }
            | null;

        if (!parsed) {
            return { ok: false, message: "정산 서버 응답을 해석할 수 없습니다.", data: null, transportFailed: true, status: res.status };
        }

        return {
            ok: Boolean(parsed.ok),
            message: String(parsed.message ?? ""),
            data: (parsed.data ?? null) as T | null,
            status: res.status,
        };
    } catch {
        return { ok: false, message: "정산 서버에 연결할 수 없습니다.", data: null, transportFailed: true };
    } finally {
        clearTimeout(timer);
    }
}

/** 서명 검증(테스트·향후 역방향 호출용). PHP zpzpInternalVerify 와 같은 규칙. */
export function verifyBridgeSignature(ts: string, sign: string, rawBody: string, skewSeconds = 300, now = Date.now()) {
    if (!ts || !sign) return false;
    if (!/^\d{1,15}$/.test(ts)) return false;
    if (Math.abs(Math.floor(now / 1000) - Number(ts)) > skewSeconds) return false;
    const expect = createHmac("sha256", bridgeSecret()).update(`${ts}\n${rawBody}`).digest("hex");
    const a = Buffer.from(expect);
    const b = Buffer.from(sign);
    return a.length === b.length && timingSafeEqual(a, b);
}
