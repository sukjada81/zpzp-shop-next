// src/app/(site)/[tenant]/(app)/order/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import OrderClient, { type OrderItem } from "@/components/order/OrderClient";
import { useCart, type CartItem } from "@/lib/cart/CartProvider";

type AuthSession = {
    ok: boolean;
    loggedIn: boolean;
    tenant?: string;
    user?: { id: string; provider: string } | null;
};

export default function OrderPage() {
    const { tenant } = useParams<{ tenant: string }>();
    const { items } = useCart();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            try {
                const res = await fetch("/api/auth/session", { cache: "no-store" });
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

    const initialItems: OrderItem[] = useMemo(
        () =>
            items.map((it: CartItem) => ({
                id: String(it.productId),
                title: it.name,
                price: Number(it.price ?? 0),
                qty: Number(it.quantity ?? 0),
            })),
        [items]
    );

    if (!tenant || checking) {
        return (
            <main className="mx-auto w-full max-w-[520px] px-4 py-10 text-center text-slate-500">
                로그인 상태를 확인하는 중입니다.
            </main>
        );
    }

    return <OrderClient tenant={tenant} initialItems={initialItems} />;
}