// src/components/cart/CartPageClient.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/cart/CartProvider";
import { endpoints } from "@/lib/api/endpoints";
import { saveGuestOrderRef } from "@/lib/orders/guestOrderRefs";
import { readQuickOrderProfile } from "@/lib/profile/quickOrderProfile";

type CreateOrderResponse = {
    ok: boolean;
    orderNum?: string;
    status?: number;
    statusLabel?: string;
    message?: string;
    error?: string;
    detail?: string;
};

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
    const { items, totalPrice, updateQuantity, removeItem, clear } = useCart();
    const [submitting, setSubmitting] = useState(false);

    async function handleDirectOrder() {
        if (!items.length || submitting) return;

        const profile = readQuickOrderProfile(tenant);
        if (!profile) {
            alert("주문을 하려면 설정에서 닉네임을 먼저 저장해 주세요.");
            router.push(`/${tenant}/settings`);
            return;
        }

        try {
            setSubmitting(true);

            const res = await fetch(endpoints.createOrder(tenant), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                credentials: "include",
                cache: "no-store",
                body: JSON.stringify({
                    buyerName: profile.nickname,
                    buyerPhone: profile.phone || "",
                    receiverName: profile.nickname,
                    receiverPhone: profile.phone || "",
                    pickupAt: null,
                    message: "",
                    memo: "장바구니 바로주문",
                    direct: 1,
                    items: items.map((it) => ({
                        productId: Number(it.productId),
                        optionId:
                            it.optionId != null && String(it.optionId).trim() !== ""
                                ? Number(it.optionId)
                                : undefined,
                        optionName: it.optionName ?? "",
                        qty: Number(it.quantity ?? 0),
                    })),
                }),
            });

            const json = (await res.json().catch(() => ({}))) as CreateOrderResponse;

            if (!res.ok || json?.ok === false || !json?.orderNum) {
                throw new Error(
                    json?.message ||
                    json?.error ||
                    json?.detail ||
                    `주문 생성 실패 (HTTP ${res.status})`
                );
            }

            const orderNum = json.orderNum;

            saveGuestOrderRef({
                tenant,
                orderNum,
                phone: profile.phone || "",
                buyerName: profile.nickname || "",
                createdAt: new Date().toISOString(),
            });

            clear();
            router.replace(`/${tenant}/orders?highlight=${encodeURIComponent(orderNum)}`);
        } catch (e: any) {
            alert(e?.message || "주문 처리 중 오류가 발생했습니다.");
        } finally {
            setSubmitting(false);
        }
    }

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
                                                disabled={submitting}
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
                                                disabled={submitting || !!item.soldout || isMaxReached}
                                                className="h-8 w-8 rounded-full border border-slate-200 text-sm font-bold text-slate-700 disabled:opacity-40"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => removeItem(item.productId, optionKey)}
                                        disabled={submitting}
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
                        onClick={handleDirectOrder}
                        disabled={submitting || items.length === 0}
                        className="mt-4 w-full rounded-2xl bg-[color:var(--accent)] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"
                    >
                        {submitting ? "주문 처리 중..." : "주문하기"}
                    </button>
                </>
            )}
        </main>
    );
}