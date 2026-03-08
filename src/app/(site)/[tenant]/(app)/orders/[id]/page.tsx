"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
    findOrder,
    updateOrderStatus,
    type OrderRecord,
} from "@/lib/orders/ordersStore";

export default function OrderDetailPage({
                                            params,
                                        }: {
    params: { tenant: string; id: string };
}) {
    const { tenant, id } = params;

    const [order, setOrder] = useState<OrderRecord | null>(null);

    const reload = () => {
        setOrder(findOrder(tenant, id));
    };

    useEffect(() => {
        reload();
    }, [tenant, id]);

    if (!order) {
        return (
            <main className="mx-auto max-w-[520px] px-4 pb-24 pt-3">
                주문 정보를 찾을 수 없습니다.
            </main>
        );
    }

    const isCancelable = order.status === "결제완료";
    const canComplete = order.status === "픽업대기";

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24 pt-3">
            <div className="mb-3 flex items-center justify-between">
                <Link
                    href={`/${tenant}/orders`}
                    className="rounded-xl border px-3 py-2 text-sm font-extrabold"
                >
                    ← 주문내역
                </Link>

                <div className="text-sm font-extrabold">주문상세</div>

                <div className="w-[78px]" />
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex justify-between text-sm">
                    <span>주문번호</span>
                    <span className="font-bold">{order.orderNo}</span>
                </div>

                <div className="mt-2 flex justify-between text-sm">
                    <span>상태</span>
                    <span className="font-bold">{order.status}</span>
                </div>

                <div className="mt-2 flex justify-between text-sm">
                    <span>주문일시</span>
                    <span className="font-bold">{order.createdAt}</span>
                </div>

                <div className="mt-4 space-y-3">
                    {order.lines.map((l, idx) => (
                        <div key={`${l.productId}_${idx}`} className="rounded-xl border p-3">
                            <div className="flex items-center gap-3">
                                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-[color:var(--brand-soft)]">
                                    {l.thumbnailUrl ? (
                                        <img src={l.thumbnailUrl} alt={l.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="h-full w-full bg-gradient-to-br from-white to-[color:var(--brand-soft)]" />
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="font-extrabold line-clamp-2">{l.name}</div>
                                    <div className="mt-1 flex justify-between text-sm">
                                        <span>{l.quantity}개</span>
                                        <span>{(l.price * l.quantity).toLocaleString()}원</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-4 flex justify-between border-t pt-3 text-base font-extrabold">
                    <span>총 결제 금액</span>
                    <span>{order.totalPrice.toLocaleString()}원</span>
                </div>
            </div>

            <div className="mt-6 space-y-3">
                {isCancelable && (
                    <button
                        onClick={() => {
                            updateOrderStatus(tenant, order.orderNo, "취소");
                            reload();
                        }}
                        className="w-full rounded-2xl bg-red-500 py-3 text-white font-extrabold"
                    >
                        주문 취소
                    </button>
                )}

                {order.status === "결제완료" && (
                    <button
                        onClick={() => {
                            updateOrderStatus(tenant, order.orderNo, "픽업대기");
                            reload();
                        }}
                        className="w-full rounded-2xl bg-black py-3 text-white font-extrabold"
                    >
                        픽업대기로 변경 (테스트용)
                    </button>
                )}

                {canComplete && (
                    <button
                        onClick={() => {
                            updateOrderStatus(tenant, order.orderNo, "픽업완료");
                            reload();
                        }}
                        className="w-full rounded-2xl bg-green-600 py-3 text-white font-extrabold"
                    >
                        픽업 완료 처리
                    </button>
                )}
            </div>
        </main>
    );
}