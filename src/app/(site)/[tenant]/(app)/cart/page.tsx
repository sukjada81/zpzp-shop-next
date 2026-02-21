"use client";

import { useCart } from "@/lib/cart/CartProvider";
import Link from "next/link";

export default function CartPage({
                                     params,
                                 }: {
    params: { tenant: string };
}) {
    const { tenant } = params;
    const { items, totalPrice } = useCart();

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24 pt-3">
            <div className="text-base font-extrabold text-slate-900 mb-3">
                장바구니
            </div>

            {items.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <div className="text-[15px] font-extrabold text-slate-900">
                        장바구니가 비어있습니다
                    </div>

                    <Link
                        href={`/${tenant}/goods`}
                        className="mt-4 inline-flex rounded-2xl bg-[color:var(--brand)] px-4 py-3 text-sm font-extrabold text-white hover:opacity-90"
                    >
                        상품 보러가기
                    </Link>
                </div>
            ) : (
                <>
                    <section className="space-y-3">
                        {items.map((item) => (
                            <div
                                key={item.productId}
                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                            >
                                <div className="text-sm font-extrabold text-slate-900">
                                    {item.name}
                                </div>

                                <div className="mt-2 flex justify-between text-sm text-slate-600">
                                    <span>{item.quantity}개</span>
                                    <span>
                    {(item.price * item.quantity).toLocaleString()}원
                  </span>
                                </div>
                            </div>
                        ))}
                    </section>

                    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex justify-between text-base font-extrabold text-slate-900">
                            <span>총 결제 금액</span>
                            <span>{totalPrice.toLocaleString()}원</span>
                        </div>
                    </div>

                    <Link
                        href={`/${tenant}/order`}
                        className="mt-6 block w-full rounded-2xl bg-[color:var(--brand)] py-4 text-center text-base font-extrabold text-white hover:opacity-90"
                    >
                        주문하기
                    </Link>
                </>
            )}
        </main>
    );
}