"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

export default function TossPaymentFailPage() {
    const { tenant } = useParams<{ tenant: string }>();
    const searchParams = useSearchParams();
    const message =
        searchParams.get("msg") ||
        "결제가 완료되지 않았습니다. 다시 시도해 주세요.";

    return (
        <main className="mx-auto max-w-[520px] px-4 py-16 text-center">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-[20px] font-extrabold text-slate-900">결제 실패</div>
                <p className="mt-4 text-[14px] font-semibold leading-6 text-slate-600">{message}</p>
                <div className="mt-6 flex flex-col gap-2">
                    <Link
                        href={`/${tenant}/order`}
                        className="rounded-2xl bg-[color:var(--accent)] px-4 py-3 text-sm font-extrabold text-white"
                    >
                        주문 페이지로 돌아가기
                    </Link>
                    <Link
                        href={`/${tenant}`}
                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-extrabold text-slate-700"
                    >
                        쇼핑 계속하기
                    </Link>
                </div>
            </div>
        </main>
    );
}
