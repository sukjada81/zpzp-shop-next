// src/app/(site)/[tenant]/(auth)/login/page.tsx
"use client";

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

export default function TenantLoginPage() {
    const params = useParams<{ tenant?: string }>();
    const sp = useSearchParams();

    const tenant = (params?.tenant as string) || "";
    const returnToParam = sp.get("returnTo");

    const AUTH_ORIGIN = process.env.NEXT_PUBLIC_AUTH_ORIGIN || "https://auth.discountallday.kr";

    useEffect(() => {
        const origin =
            typeof window !== "undefined"
                ? window.location.origin
                : `https://${tenant}.discountallday.kr`;

        const defaultReturnTo = tenant ? new URL("/home", origin).toString() : origin;
        const returnTo = returnToParam || defaultReturnTo;

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