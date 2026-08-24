// src/app/login/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type SessionResponse = {
    ok?: boolean;
    loggedIn?: boolean;
    member?: {
        uid?: number | string;
        id?: string;
        name?: string;
        tenantSlug?: string;
    } | null;
    tenant?: string;
};

/** 셀러 콘솔 tenant 가 될 수 없는 예약 슬러그 — /hq/… 는 스토어 경로다. */
const NON_TENANT_SLUGS = new Set([
    "www",
    "admin",
    "auth",
    "api",
    "select-tenant",
    "seller",
    "hq",
]);

function isNonTenantSlug(tenant: string) {
    const t = (tenant || "").trim().toLowerCase();
    return !t || NON_TENANT_SLUGS.has(t);
}

function isCrossSubdomainReturn(returnTo: string) {
    if (typeof window === "undefined") return false;
    if (!/^https?:\/\//i.test(returnTo)) return false;
    try {
        const target = new URL(returnTo).hostname.toLowerCase();
        const here = window.location.hostname.toLowerCase();
        return Boolean(target && here && target !== here);
    } catch {
        return false;
    }
}

export default function LoginPage() {
    const [loading, setLoading] = useState(true);
    const [loggedIn, setLoggedIn] = useState(false);
    const [error, setError] = useState("");

    const params = useMemo(() => {
        if (typeof window === "undefined") {
            return new URLSearchParams();
        }
        return new URLSearchParams(window.location.search);
    }, []);

    // DAD 잔재였던 하드코딩 기본값 "a" 제거 — 존재하지 않는 점포라서,
    // tenant 폴백을 fail-closed 로 바꾼 뒤로는 "a" 가 그대로 400 TENANT_NOT_RESOLVED 가 됐다.
    // 비우면 /auth/kakao/login 이 selectedTenant 쿠키 → 점포선택 순으로 폴백한다.
    const tenant = params.get("tenant") || "";
    const returnToParam = params.get("returnTo") || "";
    const syncFailed = params.get("syncFailed") === "1";

    const CONTINUE_ATTEMPT_KEY = "zpzp_auth_continue_attempts";

    const isSellerReturn = useMemo(() => {
        const raw = returnToParam || "";
        if (/^https?:\/\/[^/]*seller\./i.test(raw)) return true;
        const t = tenant.trim().toLowerCase();
        if (!t || isNonTenantSlug(t)) return false;
        const path = raw.startsWith("/") ? raw : "";
        return path === `/${t}` || path.startsWith(`/${t}/`);
    }, [returnToParam, tenant]);

    const returnTo = useMemo(() => {
        const raw = returnToParam || (isSellerReturn ? `/${tenant}` : "/home");
        if (/^https?:\/\//i.test(raw)) {
            return raw;
        }
        const path = raw.startsWith("/") ? raw : "/home";
        const t = tenant.trim().toLowerCase();
        // 상대경로 /{tenant}… 는 셀러 콘솔 — hq 등 예약 슬러그는 스토어 경로이므로 제외
        if (
            t &&
            !isNonTenantSlug(t) &&
            (path === `/${t}` || path.startsWith(`/${t}/`))
        ) {
            const sellerOrigin =
                process.env.NEXT_PUBLIC_SELLER_ORIGIN?.replace(/\/+$/, "") ||
                "https://seller.zpzp.kr";
            return `${sellerOrigin}${path}`;
        }
        return path;
    }, [returnToParam, tenant, isSellerReturn]);

    useEffect(() => {
        let ignore = false;

        async function checkSession() {
            try {
                setLoading(true);
                setError("");

                const res = await fetch("/auth/session", {
                    method: "GET",
                    cache: "no-store",
                });

                const data = (await res.json().catch(() => null)) as SessionResponse | null;

                if (ignore) return;

                const isLoggedIn = Boolean(data?.loggedIn);
                setLoggedIn(isLoggedIn);

                if (isLoggedIn) {
                    if (syncFailed) {
                        try {
                            sessionStorage.removeItem(CONTINUE_ATTEMPT_KEY);
                        } catch {
                            /* ignore */
                        }
                        setError(
                            "로그인은 되었지만 관리 화면으로 이동하지 못했습니다. 로그아웃 후 다시 시도해 주세요."
                        );
                        return;
                    }

                    // auth 에만 쿠키가 있는 경우를 대비해, 다른 서브도메인이면
                    // Set-Cookie 재발급(/auth/continue) 후 이동한다.
                    if (isCrossSubdomainReturn(returnTo)) {
                        let attempts = 0;
                        try {
                            attempts = Number(
                                sessionStorage.getItem(CONTINUE_ATTEMPT_KEY) || "0"
                            );
                        } catch {
                            attempts = 0;
                        }
                        if (attempts >= 2) {
                            setError(
                                "로그인은 되었지만 이동이 반복되고 있습니다. 아래 로그아웃 후 다시 시도해 주세요."
                            );
                            return;
                        }
                        try {
                            sessionStorage.setItem(
                                CONTINUE_ATTEMPT_KEY,
                                String(attempts + 1)
                            );
                        } catch {
                            /* ignore */
                        }
                        const qs = new URLSearchParams();
                        qs.set("returnTo", returnTo);
                        if (tenant) qs.set("tenant", tenant);
                        window.location.replace(`/auth/continue?${qs.toString()}`);
                        return;
                    }
                    try {
                        sessionStorage.removeItem(CONTINUE_ATTEMPT_KEY);
                    } catch {
                        /* ignore */
                    }
                    window.location.replace(returnTo);
                    return;
                }

                try {
                    sessionStorage.removeItem(CONTINUE_ATTEMPT_KEY);
                } catch {
                    /* ignore */
                }
            } catch {
                if (!ignore) {
                    setError("세션 확인 중 오류가 발생했습니다.");
                }
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        }

        checkSession();

        return () => {
            ignore = true;
        };
    }, [returnTo, tenant, syncFailed]);

    function startKakaoLogin() {
        const qs = new URLSearchParams();
        // 빈 tenant 를 보내면 안 된다 — 라우트가 쿠키 폴백을 못 타고 빈 값 그대로 state 에 실린다.
        if (tenant) qs.set("tenant", tenant);
        qs.set("returnTo", returnTo);
        window.location.href = `/auth/kakao/login?${qs.toString()}`;
    }

    return (
        <main className="min-h-dvh flex items-center justify-center bg-slate-50 px-4">
            <div className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 text-center">
                    <h1 className="text-xl font-bold text-slate-900">
                        {isSellerReturn ? "링커 관리 로그인" : "매장 로그인"}
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                        카카오 계정으로 간편하게 로그인하세요.
                    </p>
                </div>

                <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    <div className="whitespace-pre-line text-center font-medium leading-6 text-slate-700">
                        {/* 줍줍은 배송 전용, 정책 변경 대비 보존 — "픽업 안내" → "주문·배송 안내"
                            원본: "🍀 필수 · 선택 모두 동의하기 눌러주셔야\n🔔 픽업 안내 알림톡을 발송해드릴 수 있어요!" */}
                        {"🍀 필수 · 선택 모두 동의하기 눌러주셔야\n🔔 주문·배송 안내 알림톡을 발송해드릴 수 있어요!"}
                    </div>
                </div>

                {error ? (
                    <div className="mt-4 space-y-3">
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {error}
                        </div>
                        {loggedIn ? (
                            <button
                                type="button"
                                onClick={() => {
                                    const url = new URL("/auth/logout", window.location.origin);
                                    if (tenant) url.searchParams.set("tenant", tenant);
                                    url.searchParams.set("returnTo", returnTo);
                                    window.location.href = url.toString();
                                }}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                            >
                                로그아웃 후 다시 시도
                            </button>
                        ) : null}
                    </div>
                ) : null}

                <div className="mt-6">
                    {loading ? (
                        <div className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm text-slate-500">
                            로그인 상태를 확인하는 중입니다...
                        </div>
                    ) : loggedIn ? (
                        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm text-green-700">
                            로그인 상태입니다. 이동 중입니다...
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={startKakaoLogin}
                            className="w-full rounded-xl bg-[#FEE500] px-4 py-4 text-sm font-bold text-slate-900 shadow-sm transition hover:brightness-95 active:scale-[0.99]"
                        >
                            카카오로 로그인
                        </button>
                    )}
                </div>
            </div>
        </main>
    );
}
