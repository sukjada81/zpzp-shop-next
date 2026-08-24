"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CouponsClient from "@/components/coupons/CouponsClient";

type AuthSession = {
    loggedIn?: boolean;
};

export default function CouponsPage() {
    const { tenant } = useParams<{ tenant: string }>();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function runAuthCheck() {
            try {
                const res = await fetch("/auth/session", { cache: "no-store" });
                const data = (await res.json()) as AuthSession;
                if (cancelled) return;

                if (!data.loggedIn) {
                    const authOrigin =
                        process.env.NEXT_PUBLIC_AUTH_ORIGIN || "https://auth.zpzp.kr";
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
                    process.env.NEXT_PUBLIC_AUTH_ORIGIN || "https://auth.zpzp.kr";
                const returnTo = window.location.href;
                const loginUrl = new URL("/login", authOrigin);
                if (tenant) loginUrl.searchParams.set("tenant", tenant);
                loginUrl.searchParams.set("returnTo", returnTo);
                window.location.replace(loginUrl.toString());
            }
        }

        if (tenant) runAuthCheck();

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
        <main className="mx-auto w-full max-w-[520px] px-4 pb-24 pt-3">
            <CouponsClient tenant={tenant} />
        </main>
    );
}
