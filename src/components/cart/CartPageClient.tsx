// src/components/cart/CartPageClient.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/lib/cart/CartProvider";
import { endpoints, tenantHeader } from "@/lib/api/endpoints";

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
    const { items, updateQuantity, removeItem } = useCart();

    const subtotal = useMemo(
        () =>
            items.reduce(
                (sum, item) => sum + Number(item.price ?? 0) * Number(item.quantity ?? 0),
                0
            ),
        [items]
    );

    // 장바구니 배송비 미리보기(1차) — 주문서와 동일 quote API
    const [deliveryTotal, setDeliveryTotal] = useState(0);
    const [deliveryLoading, setDeliveryLoading] = useState(false);
    const [policyLabel, setPolicyLabel] = useState("");

    useEffect(() => {
        void (async () => {
            try {
                const res = await fetch(endpoints.deliveryPolicy(tenant), {
                    cache: "no-store",
                    headers: tenantHeader(tenant),
                });
                const json = (await res.json().catch(() => null)) as {
                    ok?: boolean;
                    policy?: { label?: string };
                } | null;
                if (json?.ok && json.policy?.label) {
                    setPolicyLabel(String(json.policy.label));
                }
            } catch {
                // 안내 문구만 — 실패해도 장바구니 사용 가능
            }
        })();
    }, [tenant]);

    useEffect(() => {
        if (!items.length) {
            setDeliveryTotal(0);
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(() => {
            void (async () => {
                setDeliveryLoading(true);
                try {
                    const res = await fetch(endpoints.deliveryQuote(tenant), {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Accept: "application/json",
                            ...tenantHeader(tenant),
                        },
                        cache: "no-store",
                        body: JSON.stringify({
                            items: items.map((item) => ({
                                productId: Number(item.productId),
                                qty: Number(item.quantity ?? 0),
                            })),
                        }),
                    });
                    const json = (await res.json().catch(() => null)) as {
                        ok?: boolean;
                        deliveryTotal?: number;
                    } | null;
                    if (!cancelled && json?.ok) {
                        setDeliveryTotal(Math.max(0, Number(json.deliveryTotal ?? 0)));
                    }
                } catch {
                    if (!cancelled) setDeliveryTotal(0);
                } finally {
                    if (!cancelled) setDeliveryLoading(false);
                }
            })();
        }, 200);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [tenant, items]);

    const payTotal = subtotal + deliveryTotal;

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24 pt-3">
            <div className="mb-3 text-base font-extrabold text-slate-900">장바구니</div>

            {policyLabel ? (
                <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-600">
                    배송: {policyLabel}
                </div>
            ) : null}

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
                        <div className="flex justify-between text-[13px] font-semibold text-slate-600">
                            <span>상품 금액</span>
                            <span>{subtotal.toLocaleString()}원</span>
                        </div>
                        <div className="mt-1 flex justify-between text-[13px] font-semibold text-slate-600">
                            <span>배송비</span>
                            <span>
                                {deliveryLoading
                                    ? "계산 중..."
                                    : deliveryTotal > 0
                                      ? `${deliveryTotal.toLocaleString()}원`
                                      : "무료"}
                            </span>
                        </div>
                        <div className="my-2 border-t border-slate-200" />
                        <div className="flex justify-between text-base font-extrabold text-slate-900">
                            <span>예상 결제 금액</span>
                            <span>{payTotal.toLocaleString()}원</span>
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
