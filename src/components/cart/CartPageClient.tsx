// src/components/cart/CartPageClient.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartProvider";

function getOptionKey(item: { optionId?: number | string; optionName?: string }) {
    if (item.optionId != null && String(item.optionId).trim() !== "") {
        return `id:${String(item.optionId)}`;
    }
    if (item.optionName != null && String(item.optionName).trim() !== "") {
        return `name:${String(item.optionName).trim()}`;
    }
    return "default";
}

function getMaxSelectableQty(item?: { qtyType?: number; stockQty?: number }) {
    if (!item) return Number.POSITIVE_INFINITY;
    if (Number(item.qtyType ?? 1) === 1) return Number.POSITIVE_INFINITY;
    const qty = Number(item.stockQty ?? 0);
    return qty > 0 ? qty : 0;
}

export default function CartPageClient({ tenant }: { tenant: string }) {
    const router = useRouter();
    const { items, totalPrice, updateQuantity, removeItem } = useCart();

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24 pt-3">
            <div className="mb-3 text-base font-extrabold text-slate-900">장바구니</div>

            {items.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <div className="text-[15px] font-extrabold text-slate-900">
                        장바구니가 비어있습니다
                    </div>

                    <Link
                        href={`/${tenant}/goods`}
                        className="mt-4 inline-flex rounded-2xl bg-[color:var(--accent)] px-4 py-3 text-sm font-extrabold text-white hover:opacity-90"
                    >
                        상품 보러가기
                    </Link>
                </div>
            ) : (
                <>
                    <section className="space-y-3">
                        {items.map((item) => {
                            const optionKey = getOptionKey(item);
                            const maxQty = getMaxSelectableQty(item);
                            const isMaxReached =
                                maxQty !== Number.POSITIVE_INFINITY &&
                                Number(item.quantity ?? 0) >= maxQty;

                            return (
                                <div
                                    key={`${item.productId}:${optionKey}`}
                                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                                >
                                    <div className="text-sm font-extrabold text-slate-900">
                                        {item.name}
                                    </div>

                                    {item.optionName ? (
                                        <div className="mt-1 text-xs font-semibold text-slate-500">
                                            옵션: {item.optionName}
                                        </div>
                                    ) : null}

                                    {item.stockNote ? (
                                        <div className="mt-1 text-[12px] font-semibold text-slate-500">
                                            {item.stockNote}
                                        </div>
                                    ) : null}

                                    <div className="mt-3 flex items-center justify-between gap-3">
                                        <div className="text-sm font-extrabold text-slate-900">
                                            {(
                                                Number(item.price ?? 0) * Number(item.quantity ?? 0)
                                            ).toLocaleString()}
                                            원
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    updateQuantity(
                                                        item.productId,
                                                        Number(item.quantity ?? 0) - 1,
                                                        optionKey
                                                    )
                                                }
                                                disabled={false}
                                                className="h-8 w-8 rounded-full border border-slate-200 text-sm font-bold text-slate-700 disabled:opacity-40"
                                            >
                                                -
                                            </button>
                                            <div className="min-w-[28px] text-center text-sm font-extrabold text-slate-900">
                                                {item.quantity}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    updateQuantity(
                                                        item.productId,
                                                        Number(item.quantity ?? 0) + 1,
                                                        optionKey
                                                    )
                                                }
                                                disabled={!!item.soldout || isMaxReached}
                                                className="h-8 w-8 rounded-full border border-slate-200 text-sm font-bold text-slate-700 disabled:opacity-40"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => removeItem(item.productId, optionKey)}
                                        disabled={false}
                                        className="mt-3 text-xs font-bold text-rose-600 disabled:opacity-40"
                                    >
                                        삭제
                                    </button>
                                </div>
                            );
                        })}
                    </section>

                    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex justify-between text-base font-extrabold text-slate-900">
                            <span>총 결제 금액</span>
                            <span>{totalPrice.toLocaleString()}원</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => router.push(`/${tenant}/order`)}
                        disabled={items.length === 0}
                        className="mt-4 w-full rounded-2xl bg-[color:var(--accent)] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"
                    >
                        주문하기
                    </button>
                </>
            )}
        </main>
    );
}