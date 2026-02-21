// src/components/orders/OrdersClient.tsx
"use client";

import Link from "next/link";

export type OrderSummary = {
    orderNo: string;
    status: "주문완료" | "결제완료" | "픽업대기" | "픽업완료" | "취소";
    title: string;
    totalPrice: number;
    createdAt: string; // "2026-02-21 12:34"
};

export default function OrdersClient(props: {
    tenant: string;
    initialOrders?: OrderSummary[];
}) {
    const { tenant, initialOrders } = props;

    // ✅ undefined 안전 처리
    const orders = initialOrders ?? [];

    return (
        <section className="mt-3 space-y-3">
            {orders.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <div className="text-[15px] font-extrabold text-slate-900">주문내역이 없습니다</div>
                    <div className="mt-2 text-xs font-semibold text-slate-500">
                        상품을 담고 주문을 진행해보세요.
                    </div>

                    <Link
                        href={`/${tenant}/goods`}
                        className="mt-4 inline-flex rounded-2xl bg-[color:var(--brand)] px-4 py-3 text-sm font-extrabold text-white hover:opacity-90"
                    >
                        상품 보러가기
                    </Link>
                </div>
            ) : (
                orders.map((o) => (
                    <Link
                        key={o.orderNo}
                        href={`/${tenant}/orders/${o.orderNo}`}
                        className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-extrabold text-slate-700">
                    {o.status}
                  </span>
                                    <span className="text-[11px] font-semibold text-slate-500">{o.createdAt}</span>
                                </div>

                                <div className="mt-2 line-clamp-2 text-[13px] font-extrabold text-slate-900">
                                    {o.title}
                                </div>

                                <div className="mt-2 text-[13px] font-extrabold text-slate-900">
                                    {o.totalPrice.toLocaleString()}원
                                </div>
                            </div>

                            <div className="shrink-0 text-sm font-extrabold text-slate-400">→</div>
                        </div>
                    </Link>
                ))
            )}

            {/* 하단 안내 */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm">
                주문 후 <span className="font-extrabold">픽업 일정</span>은 상품 상세/주문 상세에서 확인할 수 있어요.
            </div>
        </section>
    );
}