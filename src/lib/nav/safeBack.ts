import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

type HistoryStateWithIdx = { idx?: number };

/**
 * 모바일에서 딥링크/외부 유입 시 router.back() 이 무반응인 경우가 많다.
 * 히스토리가 있으면 back 시도, 안 움직이면 fallback 으로 push.
 */
export function safeBack(router: AppRouterInstance, fallbackHref: string) {
    if (typeof window === "undefined") {
        router.push(fallbackHref);
        return;
    }

    const idx = (window.history.state as HistoryStateWithIdx | null)?.idx;
    const canBack =
        (typeof idx === "number" && idx > 0) ||
        (() => {
            try {
                const ref = document.referrer;
                return Boolean(ref && new URL(ref).origin === window.location.origin);
            } catch {
                return false;
            }
        })();

    if (!canBack) {
        router.push(fallbackHref);
        return;
    }

    const before = window.location.href;
    router.back();

    window.setTimeout(() => {
        if (window.location.href === before) {
            router.push(fallbackHref);
        }
    }, 250);
}
