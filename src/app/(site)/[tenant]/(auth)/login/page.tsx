// src/app/(site)/[tenant]/(auth)/login/page.tsx
"use client";

import { useParams, useSearchParams } from "next/navigation";

export default function TenantLoginPage() {
    const params = useParams<{ tenant?: string }>();
    const sp = useSearchParams();

    const tenant = (params?.tenant as string) || "";
    const returnToParam = sp.get("returnTo");

    const AUTH_ORIGIN = process.env.NEXT_PUBLIC_AUTH_ORIGIN || "https://auth.discountallday.kr";

    // ✅ defaultReturnTo는 "현재 접속 origin" 기반으로 만든다.
    // - 로컬: http://a.discountallday.kr:3000/home
    // - 운영: https://a.discountallday.kr/home
    const origin =
        typeof window !== "undefined" ? window.location.origin : `https://${tenant}.discountallday.kr`;

    const defaultReturnTo = tenant ? new URL("/home", origin).toString() : origin;

    const returnTo = returnToParam || defaultReturnTo;

    return (
        <main className="min-h-dvh flex flex-col items-center justify-center px-6">
            <div className="w-full max-w-[420px] flex flex-col items-center">
                <div className="mb-6 text-center">
                    <div className="text-xl font-extrabold tracking-wide">매장 로그인</div>
                    <div className="mt-2 text-sm text-slate-500">인증 페이지로 이동합니다.</div>
                </div>

                <div className="w-full rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-sm text-slate-700 leading-6">
                        <div>• 카카오 로그인은 인증 서버에서 진행됩니다.</div>
                    </div>
                </div>

                <button
                    type="button"
                    className="mt-5 w-full rounded-xl bg-[var(--kakao)] py-4 font-bold text-black shadow-sm active:scale-[0.99]"
                    onClick={() => {
                        const loginUrl = new URL("/login", AUTH_ORIGIN);
                        if (tenant) loginUrl.searchParams.set("tenant", tenant);
                        loginUrl.searchParams.set("returnTo", returnTo);
                        window.location.href = loginUrl.toString();
                    }}
                >
                    카카오 로그인으로 이동
                </button>

                <p className="mt-3 text-xs text-slate-400 text-center">
                    로그인 시 서비스 이용약관에 동의하는 것으로 간주됩니다.
                </p>

                <div className="mt-14 w-full border-t pt-8 text-center text-xs text-slate-400">
                    © 2026. All rights reserved.
                </div>
            </div>
        </main>
    );
}