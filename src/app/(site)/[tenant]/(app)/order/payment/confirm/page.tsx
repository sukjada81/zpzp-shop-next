"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { endpoints } from "@/lib/api/endpoints";

type ConfirmResponse = {
    ok?: boolean;
    orderNum?: string;
    message?: string;
    reason?: string;
};

export default function TossPaymentConfirmPage() {
    const { tenant } = useParams<{ tenant: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [message, setMessage] = useState("결제를 확인하는 중입니다...");

    const query = useMemo(
        () => ({
            paymentKey: searchParams.get("paymentKey") || "",
            orderId: searchParams.get("orderId") || "",
            amount: searchParams.get("amount") || "",
        }),
        [searchParams]
    );

    useEffect(() => {
        if (!tenant) return;

        const { paymentKey, orderId, amount } = query;
        if (!paymentKey || !orderId || !amount) {
            setMessage("결제 승인 정보가 올바르지 않습니다.");
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                const url = new URL(endpoints.tossConfirm(tenant), window.location.origin);
                url.searchParams.set("paymentKey", paymentKey);
                url.searchParams.set("orderId", orderId);
                url.searchParams.set("amount", amount);

                const res = await fetch(url.pathname + url.search, {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                    headers: { Accept: "application/json" },
                });

                const json = (await res.json().catch(() => ({}))) as ConfirmResponse;

                if (cancelled) return;

                if (!res.ok || !json?.ok || !json.orderNum) {
                    const failMsg = json?.message || "결제 확인에 실패했습니다.";
                    router.replace(
                        `/${tenant}/order/payment/fail?reason=${encodeURIComponent(json?.reason || "confirm")}&msg=${encodeURIComponent(failMsg)}`
                    );
                    return;
                }

                router.replace(`/${tenant}/orders?highlight=${encodeURIComponent(json.orderNum)}`);
            } catch (error: unknown) {
                if (cancelled) return;
                const failMsg =
                    error instanceof Error ? error.message : "결제 확인 중 오류가 발생했습니다.";
                router.replace(
                    `/${tenant}/order/payment/fail?reason=network&msg=${encodeURIComponent(failMsg)}`
                );
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [tenant, query, router]);

    return (
        <main className="mx-auto flex min-h-[60vh] max-w-[520px] flex-col items-center justify-center px-4 py-16 text-center">
            <div className="text-[17px] font-extrabold text-slate-900">결제 처리 중</div>
            <p className="mt-3 text-[14px] font-semibold text-slate-600">{message}</p>
        </main>
    );
}
