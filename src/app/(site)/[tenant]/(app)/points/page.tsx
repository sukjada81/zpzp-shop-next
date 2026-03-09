"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type AuthSession = {
    ok: boolean;
    loggedIn: boolean;
    tenant?: string;
    user?: { id: string; provider: string } | null;
};

export default function PointsPage() {
    const { tenant } = useParams<{ tenant: string }>();
    const [checking, setChecking] = useState(true);
    const points = 0;

    useEffect(() => {
        let cancelled = false;

        async function run() {
            try {
                const res = await fetch("/auth/session", { cache: "no-store" });
                const data = (await res.json()) as AuthSession;

                if (cancelled) return;

                if (!data.loggedIn) {
                    const authOrigin =
                        process.env.NEXT_PUBLIC_AUTH_ORIGIN || "https://auth.discountallday.kr";
                    const returnTo = window.location.href;
                    const loginUrl = new URL("/login", authOrigin);
                    if (tenant) loginUrl.searchParams.set("tenant", tenant);
                    loginUrl.searchParams.set("returnTo", returnTo);
                    window.location.replace(loginUrl.toString());
                    return;
                }

                setChecking(false);
            } catch {
                if (cancelled) return;
                const authOrigin =
                    process.env.NEXT_PUBLIC_AUTH_ORIGIN || "https://auth.discountallday.kr";
                const returnTo = window.location.href;
                const loginUrl = new URL("/login", authOrigin);
                if (tenant) loginUrl.searchParams.set("tenant", tenant);
                loginUrl.searchParams.set("returnTo", returnTo);
                window.location.replace(loginUrl.toString());
            }
        }

        if (tenant) run();

        return () => {
            cancelled = true;
        };
    }, [tenant]);

    if (!tenant || checking) {
        return (
            <main className="mx-auto w-full max-w-[520px] px-4 py-10 text-center text-slate-500">
                로그인 상태를 확인하는 중입니다.
            </main>
        );
    }

    return (
        <main className="mx-auto w-full max-w-[520px] px-4 py-5">
            <div className="text-[18px] font-extrabold text-slate-900">내 포인트</div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div
                    className="rounded-2xl p-5 text-white"
                    style={{ background: "var(--brand)" }}
                >
                    <div className="text-[13px] font-extrabold opacity-95">사용 가능 포인트</div>
                    <div className="mt-2 text-[40px] font-extrabold leading-none">
                        {points.toLocaleString()}P
                    </div>
                    <div className="mt-2 text-[12px] opacity-90">0원으로 사용 가능</div>

                    <button
                        type="button"
                        className="mt-4 w-full rounded-xl bg-white/15 px-4 py-3 text-[14px] font-extrabold text-white hover:bg-white/20"
                        onClick={() => alert("프론트-only 단계: 포인트 사용 흐름은 추후 결제/승인과 연동")}
                    >
                        포인트 사용하기 →
                    </button>
                </div>

                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                    <div className="text-[13px] font-extrabold text-rose-700">유인 매장 운영 시간에만 사용 가능</div>
                    <div className="mt-1 text-[12px] text-rose-600 leading-5">
                        포인트는 직원이 근무하는 유인 시간에만 사용하실 수 있습니다.
                    </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[12px] text-slate-600 leading-5">
                        💡 포인트는 현장에서 결제 시 사용 가능합니다. 사용하실 금액을 선택하고 직원에게 승인 코드를 알려주세요.
                    </div>
                </div>
            </div>

            <div className="mt-6 text-[14px] font-extrabold text-slate-900">사용 내역</div>
            <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-400">
                <div className="mx-auto mb-2 h-10 w-10 rounded-2xl border border-slate-200 grid place-items-center">
                    📅
                </div>
                <div className="text-[13px] font-semibold">아직 포인트 사용 내역이 없어요</div>
            </div>
        </main>
    );
}