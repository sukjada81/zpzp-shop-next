// src/app/(site)/[tenant]/(app)/order/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartProvider";
import { addOrder } from "@/lib/orders/ordersStore";

type PageProps = {
    params: { tenant: string };
};

export default function OrderPage({ params }: PageProps) {
    const { tenant } = params;
    const router = useRouter();

    const { items, totalPrice, clear } = useCart();

    const disabled = items.length === 0;

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24 pt-3">
            <div className="mb-3 text-base font-extrabold text-slate-900">주문서</div>

            {/* 주문 요약 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="space-y-2 text-sm text-slate-700">
                    <div className="flex justify-between">
                        <span>상품 금액</span>
                        <span className="font-bold">{totalPrice.toLocaleString()}원</span>
                    </div>

                    <div className="flex justify-between">
                        <span>배송/픽업 비용</span>
                        <span className="font-bold">0원</span>
                    </div>

                    <div className="flex justify-between border-t pt-2 text-base font-extrabold text-slate-900">
                        <span>총 결제 금액</span>
                        <span>{totalPrice.toLocaleString()}원</span>
                    </div>
                </div>
            </div>

            {/* 결제 버튼 */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => {
                    if (disabled) return;

                    // ✅ 주문 저장 (localStorage)
                    const order = addOrder(
                        tenant,
                        items.map((it) => ({
                            productId: it.productId,
                            name: it.name,
                            price: it.price,
                            quantity: it.quantity,
                        })),
                    );

                    // ✅ 장바구니 비우기
                    clear();

                    // ✅ 주문내역으로 이동
                    router.push(`/${tenant}/orders?created=${encodeURIComponent(order.orderNo)}`);
                }}
                className={[
                    "mt-6 w-full rounded-2xl py-4 text-base font-extrabold text-white",
                    disabled ? "bg-slate-300" : "bg-[color:var(--brand)] hover:opacity-90",
                ].join(" ")}
            >
                결제하기
            </button>

            {disabled ? (
                <div className="mt-2 text-center text-[12px] font-semibold text-slate-500">
                    장바구니가 비어있습니다.
                </div>
            ) : null}
        </main>
    );
}