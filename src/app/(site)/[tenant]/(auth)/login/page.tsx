// src/app/(site)/[tenant]/(auth)/login/page.tsx
"use client";

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

export default function TenantLoginPage() {
    const params = useParams<{ tenant?: string }>();
    const sp = useSearchParams();

    const tenant = (params?.tenant as string) || "";
    const returnToParam = sp.get("returnTo");

    const AUTH_ORIGIN = process.env.NEXT_PUBLIC_AUTH_ORIGIN || "https://auth.zpzp.kr";

    useEffect(() => {
        const origin =
            typeof window !== "undefined"
                ? window.location.origin
                : `https://${tenant}.zpzp.kr`;

        const defaultReturnTo = tenant ? new URL("/home", origin).toString() : origin;

        // 넘어온 returnTo 가 상대경로면 **현재 스토어 origin 기준으로 절대화**한다.
        // 그대로 흘리면 카카오 콜백이 <tenant>.zpzp.kr 을 조립하는데, 링커 스토어의
        // tenant 는 hq(예약 슬러그)라 점포선택으로 폴백되고 로그인 루프가 된다.
        const returnTo = returnToParam
            ? /^https?:\/\//i.test(returnToParam)
                ? returnToParam
                : new URL(returnToParam.startsWith("/") ? returnToParam : `/${returnToParam}`, origin).toString()
            : defaultReturnTo;

        const loginUrl = new URL("/login", AUTH_ORIGIN);
        if (tenant) loginUrl.searchParams.set("tenant", tenant);
        loginUrl.searchParams.set("returnTo", returnTo);

        window.location.replace(loginUrl.toString());
    }, [AUTH_ORIGIN, returnToParam, tenant]);

    return (
        <main className="min-h-dvh flex flex-col items-center justify-center px-6">
            <div className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-6 text-center">
                <div className="text-xl font-extrabold tracking-wide">인증 페이지로 이동 중입니다</div>
                <div className="mt-3 text-sm text-slate-500">
                    잠시만 기다려 주세요.
                </div>
            </div>
        </main>
    );
}