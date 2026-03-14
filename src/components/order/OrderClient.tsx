// src/components/order/OrderClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartProvider";
import { endpoints } from "@/lib/api/endpoints";
import { saveGuestOrderRef } from "@/lib/orders/guestOrderRefs";

export type OrderItem = {
    id: string;
    title: string;
    price: number;
    qty: number;
    metaRight?: string;
    optionId?: number | string;
    optionName?: string;
};

type CreateOrderResponse = {
    ok: boolean;
    orderNum?: string;
    status?: number;
    statusLabel?: string;
    message?: string;
};

function onlyDigits(v: string) {
    return String(v ?? "").replace(/[^\d]/g, "");
}

function joinPhone(a: string, b: string, c: string) {
    return [a, b, c].map(onlyDigits).filter(Boolean).join("");
}

function nowLocalDateTimeInputValue() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
        now.getHours()
    )}:${pad(now.getMinutes())}`;
}

function toApiDateTime(value: string) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

export default function OrderClient(props: {
    tenant: string;
    initialItems: OrderItem[];
}) {
    const { tenant } = props;
    const router = useRouter();
    const cart = useCart();

    const [items, setItems] = useState<OrderItem[]>(props.initialItems);
    const [submitting, setSubmitting] = useState(false);

    const [buyerName, setBuyerName] = useState("");
    const [buyerPhoneA, setBuyerPhoneA] = useState("010");
    const [buyerPhoneB, setBuyerPhoneB] = useState("");
    const [buyerPhoneC, setBuyerPhoneC] = useState("");

    const [receiverSame, setReceiverSame] = useState(true);
    const [receiverName, setReceiverName] = useState("");
    const [receiverPhoneA, setReceiverPhoneA] = useState("010");
    const [receiverPhoneB, setReceiverPhoneB] = useState("");
    const [receiverPhoneC, setReceiverPhoneC] = useState("");

    const [pickupAt, setPickupAt] = useState(nowLocalDateTimeInputValue());
    const [message, setMessage] = useState("");
    const [memo, setMemo] = useState("");

    const subtotal = useMemo(
        () => items.reduce((sum, it) => sum + Number(it.price ?? 0) * Number(it.qty ?? 0), 0),
        [items]
    );

    const canSubmit = items.length > 0 && !submitting;

    useEffect(() => {
        if (!receiverSame) return;
        setReceiverName(buyerName);
        setReceiverPhoneA(buyerPhoneA);
        setReceiverPhoneB(buyerPhoneB);
        setReceiverPhoneC(buyerPhoneC);
    }, [receiverSame, buyerName, buyerPhoneA, buyerPhoneB, buyerPhoneC]);

    useEffect(() => {
        if (props.initialItems.length > 0) {
            setItems(props.initialItems);
            return;
        }

        if (cart.items.length > 0) {
            setItems(
                cart.items.map((item) => ({
                    id: String(item.productId),
                    title: item.name,
                    price: Number(item.price ?? 0),
                    qty: Number(item.quantity ?? 0),
                }))
            );
        }
    }, [props.initialItems, cart.items]);

    function updateQty(id: string, next: number) {
        setItems((prev) =>
            prev
                .map((it) => (it.id === id ? { ...it, qty: Math.max(0, next) } : it))
                .filter((it) => it.qty > 0)
        );
    }

    async function submitOrder() {
        if (!canSubmit) return;

        const normalizedBuyerName = buyerName.trim();
        const normalizedBuyerPhone = joinPhone(buyerPhoneA, buyerPhoneB, buyerPhoneC);

        const normalizedReceiverName = receiverSame ? normalizedBuyerName : receiverName.trim();
        const normalizedReceiverPhone = receiverSame
            ? normalizedBuyerPhone
            : joinPhone(receiverPhoneA, receiverPhoneB, receiverPhoneC);

        if (!normalizedBuyerName) {
            alert("주문자 이름을 입력해 주세요.");
            return;
        }

        if (normalizedBuyerPhone.length < 10) {
            alert("주문자 연락처를 정확히 입력해 주세요.");
            return;
        }

        if (!normalizedReceiverName) {
            alert("수령인 이름을 입력해 주세요.");
            return;
        }

        if (normalizedReceiverPhone.length < 10) {
            alert("수령인 연락처를 정확히 입력해 주세요.");
            return;
        }

        if (!items.length) {
            alert("주문할 상품이 없습니다.");
            return;
        }

        setSubmitting(true);

        try {
            const res = await fetch(endpoints.createOrder(tenant), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                credentials: "include",
                cache: "no-store",
                body: JSON.stringify({
                    buyerName: normalizedBuyerName,
                    buyerPhone: normalizedBuyerPhone,
                    receiverName: normalizedReceiverName,
                    receiverPhone: normalizedReceiverPhone,
                    pickupAt: toApiDateTime(pickupAt),
                    message: message.trim(),
                    memo: memo.trim(),
                    direct: 0,
                    items: items.map((it) => ({
                        productId: Number(it.id),
                        optionId: it.optionId ? Number(it.optionId) : 0,
                        optionName: it.optionName ?? "",
                        qty: Number(it.qty ?? 0),
                    })),
                }),
            });

            const json = (await res.json().catch(() => ({}))) as CreateOrderResponse;

            if (!res.ok || json?.ok === false || !json?.orderNum) {
                throw new Error(json?.message || `주문 생성 실패 (HTTP ${res.status})`);
            }

            saveGuestOrderRef({
                tenant,
                orderNum: json.orderNum,
                phone: normalizedBuyerPhone,
                buyerName: normalizedBuyerName,
                createdAt: new Date().toISOString(),
            });

            cart.clear();
            router.replace(`/${tenant}/orders?highlight=${encodeURIComponent(json.orderNum)}`);
        } catch (e: any) {
            alert(e?.message || "주문 처리 중 오류가 발생했습니다.");
        } finally {
            setSubmitting(false);
        }
    }

    const buyerPhonePreview = joinPhone(buyerPhoneA, buyerPhoneB, buyerPhoneC);
    const receiverPhonePreview = receiverSame
        ? buyerPhonePreview
        : joinPhone(receiverPhoneA, receiverPhoneB, receiverPhoneC);

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-28 pt-3">
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="text-[17px] font-extrabold text-slate-900">주문 상품</div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                        {items.length}건
                    </span>
                </div>

                {items.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-[13px] font-semibold text-slate-600">
                        주문할 상품이 없습니다.
                    </div>
                ) : (
                    <div className="mt-3 space-y-3">
                        {items.map((it) => (
                            <div key={it.id} className="rounded-2xl border border-slate-200 p-3">
                                <div className="line-clamp-2 text-[14px] font-extrabold text-slate-900">
                                    {it.title}
                                </div>

                                {it.optionName ? (
                                    <div className="mt-1 text-[12px] font-semibold text-slate-500">
                                        옵션: {it.optionName}
                                    </div>
                                ) : null}

                                <div className="mt-3 flex items-center justify-between gap-3">
                                    <div className="text-[14px] font-extrabold text-slate-900">
                                        {(it.price * it.qty).toLocaleString()}원
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => updateQty(it.id, it.qty - 1)}
                                            className="h-8 w-8 rounded-full border border-slate-200 text-sm font-bold text-slate-700"
                                        >
                                            -
                                        </button>
                                        <div className="min-w-[28px] text-center text-sm font-extrabold text-slate-900">
                                            {it.qty}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => updateQty(it.id, it.qty + 1)}
                                            className="h-8 w-8 rounded-full border border-slate-200 text-sm font-bold text-slate-700"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[16px] font-extrabold text-slate-900">주문자 정보</div>

                <div className="mt-3 space-y-3">
                    <label className="block">
                        <div className="mb-1 text-[13px] font-bold text-slate-800">이름</div>
                        <input
                            value={buyerName}
                            onChange={(e) => setBuyerName(e.target.value)}
                            className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none ring-0 placeholder:text-slate-400"
                            placeholder="주문자 이름"
                        />
                    </label>

                    <div>
                        <div className="mb-1 text-[13px] font-bold text-slate-800">연락처</div>
                        <div className="grid grid-cols-3 gap-2">
                            <input
                                value={buyerPhoneA}
                                onChange={(e) => setBuyerPhoneA(onlyDigits(e.target.value).slice(0, 3))}
                                className="h-12 rounded-2xl border border-slate-200 px-3 text-center text-sm outline-none"
                                inputMode="numeric"
                            />
                            <input
                                value={buyerPhoneB}
                                onChange={(e) => setBuyerPhoneB(onlyDigits(e.target.value).slice(0, 4))}
                                className="h-12 rounded-2xl border border-slate-200 px-3 text-center text-sm outline-none"
                                inputMode="numeric"
                            />
                            <input
                                value={buyerPhoneC}
                                onChange={(e) => setBuyerPhoneC(onlyDigits(e.target.value).slice(0, 4))}
                                className="h-12 rounded-2xl border border-slate-200 px-3 text-center text-sm outline-none"
                                inputMode="numeric"
                            />
                        </div>
                    </div>
                </div>
            </section>

            <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="text-[16px] font-extrabold text-slate-900">수령인 정보</div>
                    <label className="flex items-center gap-2 text-[12px] font-bold text-slate-700">
                        <input
                            type="checkbox"
                            checked={receiverSame}
                            onChange={(e) => setReceiverSame(e.target.checked)}
                        />
                        주문자와 동일
                    </label>
                </div>

                <div className="mt-3 space-y-3">
                    <label className="block">
                        <div className="mb-1 text-[13px] font-bold text-slate-800">이름</div>
                        <input
                            value={receiverSame ? buyerName : receiverName}
                            onChange={(e) => setReceiverName(e.target.value)}
                            disabled={receiverSame}
                            className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none disabled:bg-slate-50"
                            placeholder="수령인 이름"
                        />
                    </label>

                    <div>
                        <div className="mb-1 text-[13px] font-bold text-slate-800">연락처</div>
                        <div className="grid grid-cols-3 gap-2">
                            <input
                                value={receiverSame ? buyerPhoneA : receiverPhoneA}
                                onChange={(e) =>
                                    setReceiverPhoneA(onlyDigits(e.target.value).slice(0, 3))
                                }
                                disabled={receiverSame}
                                className="h-12 rounded-2xl border border-slate-200 px-3 text-center text-sm outline-none disabled:bg-slate-50"
                                inputMode="numeric"
                            />
                            <input
                                value={receiverSame ? buyerPhoneB : receiverPhoneB}
                                onChange={(e) =>
                                    setReceiverPhoneB(onlyDigits(e.target.value).slice(0, 4))
                                }
                                disabled={receiverSame}
                                className="h-12 rounded-2xl border border-slate-200 px-3 text-center text-sm outline-none disabled:bg-slate-50"
                                inputMode="numeric"
                            />
                            <input
                                value={receiverSame ? buyerPhoneC : receiverPhoneC}
                                onChange={(e) =>
                                    setReceiverPhoneC(onlyDigits(e.target.value).slice(0, 4))
                                }
                                disabled={receiverSame}
                                className="h-12 rounded-2xl border border-slate-200 px-3 text-center text-sm outline-none disabled:bg-slate-50"
                                inputMode="numeric"
                            />
                        </div>
                    </div>
                </div>
            </section>

            <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[16px] font-extrabold text-slate-900">픽업/요청사항</div>

                <div className="mt-3 space-y-3">
                    <label className="block">
                        <div className="mb-1 text-[13px] font-bold text-slate-800">픽업 예정일시</div>
                        <input
                            type="datetime-local"
                            value={pickupAt}
                            onChange={(e) => setPickupAt(e.target.value)}
                            className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none"
                        />
                    </label>

                    <label className="block">
                        <div className="mb-1 text-[13px] font-bold text-slate-800">요청사항</div>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="min-h-[92px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
                            placeholder="매장 전달 요청사항"
                        />
                    </label>

                    <label className="block">
                        <div className="mb-1 text-[13px] font-bold text-slate-800">내부 메모</div>
                        <textarea
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            className="min-h-[92px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
                            placeholder="추가 메모"
                        />
                    </label>
                </div>
            </section>

            <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold text-slate-700">총 주문금액</span>
                    <strong className="text-[24px] font-extrabold text-slate-900">
                        {subtotal.toLocaleString()}원
                    </strong>
                </div>

                <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-[12px] font-semibold text-slate-600">
                    주문자 연락처: {buyerPhonePreview || "-"}
                    <br />
                    수령인 연락처: {receiverPhonePreview || "-"}
                </div>
            </section>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
                <div className="mx-auto max-w-[520px]">
                    <button
                        type="button"
                        onClick={submitOrder}
                        disabled={!canSubmit}
                        className="flex h-14 w-full items-center justify-center rounded-2xl bg-[color:var(--brand,#0f172a)] text-[15px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {submitting ? "주문 처리 중..." : `${subtotal.toLocaleString()}원 주문하기`}
                    </button>
                </div>
            </div>
        </main>
    );
}