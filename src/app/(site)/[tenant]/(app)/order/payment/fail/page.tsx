/**
 * Toss failUrl landing 페이지
 * 결제창 취소·confirm 실패 시 안내 (shop-php order_payment_fail 유사)
 */
"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

function resolveFailMessage(searchParams: URLSearchParams) {
    const custom = searchParams.get("msg")?.trim();
    if (custom) return custom;

    const tossMessage = searchParams.get("message")?.trim();
    const code = searchParams.get("code")?.trim();

    if (code === "PAY_PROCESS_CANCELED" || code === "USER_CANCEL") {
        return "결제를 취소하셨습니다. 주문은 접수되지 않았습니다.";
    }

    if (tossMessage) return tossMessage;

    return "결제가 완료되지 않았습니다. 다시 시도해 주세요.";
}

export default function TossPaymentFailPage() {
    const { tenant } = useParams<{ tenant: string }>();
    const searchParams = useSearchParams();
    const message = resolveFailMessage(searchParams);

    return (
        <main className="mx-auto max-w-[520px] px-4 py-16 text-center">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
                    ✕
                </div>
                <div className="mt-4 text-[20px] font-extrabold text-slate-900">결제 실패</div>
                <p className="mt-4 text-[14px] font-semibold leading-6 text-slate-600">{message}</p>
                <div className="mt-6 flex flex-col gap-2">
                    <Link
                        href={`/${tenant}/order`}
                        className="rounded-2xl bg-[color:var(--accent)] px-4 py-3 text-sm font-extrabold text-white"
                    >
                        주문 페이지로 돌아가기
                    </Link>
                    <Link
                        href={`/${tenant}/goods`}
                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-extrabold text-slate-700"
                    >
                        쇼핑 계속하기
                    </Link>
                </div>
            </div>
        </main>
    );
}
