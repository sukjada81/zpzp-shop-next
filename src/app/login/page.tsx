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

    const tenant = params.get("tenant") || "a";
    const returnToParam = params.get("returnTo") || "/home";

    const returnTo = useMemo(() => {
        if (/^https?:\/\//i.test(returnToParam)) {
            return returnToParam;
        }
        return returnToParam.startsWith("/") ? returnToParam : "/home";
    }, [returnToParam]);

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
                    window.location.replace(returnTo);
                    return;
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
    }, [returnTo]);

    function startKakaoLogin() {
        const qs = new URLSearchParams();
        qs.set("tenant", tenant);
        qs.set("returnTo", returnTo);
        window.location.href = `/auth/kakao/login?${qs.toString()}`;
    }

    return (
        <main className="min-h-dvh flex items-center justify-center bg-slate-50 px-4">
            <div className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 text-center">
                    <h1 className="text-xl font-bold text-slate-900">매장 로그인</h1>
                    <p className="mt-2 text-sm text-slate-500">
                        카카오 계정으로 간편하게 로그인하세요.
                    </p>
                </div>

                <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    <div className="whitespace-pre-line text-center font-medium leading-6 text-slate-700">
                        {"🍀 필수 · 선택 모두 동의하기 눌러주셔야\n🔔 픽업 안내 알림톡을 발송해드릴 수 있어요!"}
                    </div>
                </div>

                {error ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {error}
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