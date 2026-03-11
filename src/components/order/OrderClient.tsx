// src/components/order/OrderClient.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartProvider";
import { endpoints } from "@/lib/api/endpoints";

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
    const cart = useCart() as any;

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

    function updateQty(id: string, next: number) {
        setItems((prev) =>
            prev
                .map((it) => (it.id === id ? { ...it, qty: Math.max(0, next) } : it))
                .filter((it) => it.qty > 0)
        );
    }

    function syncReceiverFromBuyer(nextSame: boolean) {
        setReceiverSame(nextSame);

        if (nextSame) {
            setReceiverName(buyerName);
            setReceiverPhoneA(buyerPhoneA);
            setReceiverPhoneB(buyerPhoneB);
            setReceiverPhoneC(buyerPhoneC);
        }
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

            if (typeof cart?.clear === "function") {
                cart.clear();
            }

            router.replace(
                `/${tenant}/order/complete?orderNo=${encodeURIComponent(json.orderNum)}`
            );
        } catch (e: any) {
            alert(e?.message || "주문 처리 중 오류가 발생했습니다.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-28 pt-3">
            <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="text-[15px] font-extrabold text-slate-900">주문 상품</div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                        {items.length}개
                    </span>
                </div>

                {items.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-[12px] font-semibold text-slate-600">
                        주문할 상품이 없습니다. 상품을 담아 주세요.
                    </div>
                ) : (
                    <div className="mt-3 space-y-3">
                        {items.map((it) => (
                            <div key={it.id} className="rounded-2xl border border-slate-200 p-3">
                                <div className="line-clamp-2 text-[13px] font-extrabold text-slate-900">
                                    {it.title}
                                </div>

                                {it.optionName ? (
                                    <div className="mt-1 text-[11px] font-semibold text-slate-500">
                                        옵션: {it.optionName}
                                    </div>
                                ) : null}

                                <div className="mt-2 flex items-center justify-between gap-3">
                                    <div className="text-[13px] font-extrabold text-slate-900">
                                        {(it.price * it.qty).toLocaleString()}원
                                        <span className="ml-2 text-[11px] font-semibold text-slate-500">
                                            x {it.qty}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => updateQty(it.id, it.qty - 1)}
                                            disabled={it.qty <= 1}
                                            className={[
                                                "grid h-9 w-9 place-items-center rounded-full border text-lg font-black",
                                                it.qty <= 1
                                                    ? "border-slate-200 bg-slate-50 text-slate-300"
                                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                                            ].join(" ")}
                                            aria-label="수량 감소"
                                        >
                                            –
                                        </button>

                                        <div className="w-7 text-center text-[14px] font-extrabold tabular-nums text-slate-900">
                                            {it.qty}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => updateQty(it.id, it.qty + 1)}
                                            className="grid h-9 w-9 place-items-center rounded-full border border-[color:var(--brand)] bg-[color:var(--brand)] text-lg font-black text-white hover:opacity-90"
                                            aria-label="수량 증가"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>

                                {it.metaRight ? (
                                    <div className="mt-2 text-[11px] font-semibold text-slate-500">
                                        {it.metaRight}
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">주문자</div>

                <div className="mt-3 grid gap-3">
                    <label className="grid gap-1">
                        <span className="text-[12px] font-semibold text-slate-600">이름 *</span>
                        <input
                            value={buyerName}
                            onChange={(e) => {
                                setBuyerName(e.target.value);
                                if (receiverSame) setReceiverName(e.target.value);
                            }}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-300"
                            placeholder="주문자 이름"
                        />
                    </label>

                    <div className="grid gap-1">
                        <span className="text-[12px] font-semibold text-slate-600">연락처 *</span>

                        <div className="grid grid-cols-3 gap-2">
                            <input
                                value={buyerPhoneA}
                                onChange={(e) => {
                                    setBuyerPhoneA(onlyDigits(e.target.value));
                                    if (receiverSame) setReceiverPhoneA(onlyDigits(e.target.value));
                                }}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
                            />
                            <input
                                value={buyerPhoneB}
                                onChange={(e) => {
                                    setBuyerPhoneB(onlyDigits(e.target.value));
                                    if (receiverSame) setReceiverPhoneB(onlyDigits(e.target.value));
                                }}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
                            />
                            <input
                                value={buyerPhoneC}
                                onChange={(e) => {
                                    setBuyerPhoneC(onlyDigits(e.target.value));
                                    if (receiverSame) setReceiverPhoneC(onlyDigits(e.target.value));
                                }}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
                            />
                        </div>
                    </div>
                </div>
            </section>

            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="text-[15px] font-extrabold text-slate-900">수령 정보</div>
                    <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-500">
                        <input
                            type="checkbox"
                            checked={receiverSame}
                            onChange={(e) => syncReceiverFromBuyer(e.target.checked)}
                        />
                        주문자와 동일
                    </label>
                </div>

                <div className="mt-3 grid gap-3">
                    <label className="grid gap-1">
                        <span className="text-[12px] font-semibold text-slate-600">수령인 이름 *</span>
                        <input
                            value={receiverName}
                            onChange={(e) => setReceiverName(e.target.value)}
                            disabled={receiverSame}
                            className={[
                                "rounded-2xl border px-3 py-3 text-sm font-semibold outline-none",
                                receiverSame
                                    ? "border-slate-200 bg-slate-50 text-slate-400"
                                    : "border-slate-200 bg-white text-slate-900",
                            ].join(" ")}
                            placeholder="수령인 이름"
                        />
                    </label>

                    <div className="grid gap-1">
                        <span className="text-[12px] font-semibold text-slate-600">수령인 연락처 *</span>
                        <div className="grid grid-cols-3 gap-2">
                            <input
                                value={receiverPhoneA}
                                onChange={(e) => setReceiverPhoneA(onlyDigits(e.target.value))}
                                disabled={receiverSame}
                                className={[
                                    "rounded-2xl border px-3 py-3 text-sm font-semibold outline-none",
                                    receiverSame
                                        ? "border-slate-200 bg-slate-50 text-slate-400"
                                        : "border-slate-200 bg-white text-slate-900",
                                ].join(" ")}
                            />
                            <input
                                value={receiverPhoneB}
                                onChange={(e) => setReceiverPhoneB(onlyDigits(e.target.value))}
                                disabled={receiverSame}
                                className={[
                                    "rounded-2xl border px-3 py-3 text-sm font-semibold outline-none",
                                    receiverSame
                                        ? "border-slate-200 bg-slate-50 text-slate-400"
                                        : "border-slate-200 bg-white text-slate-900",
                                ].join(" ")}
                            />
                            <input
                                value={receiverPhoneC}
                                onChange={(e) => setReceiverPhoneC(onlyDigits(e.target.value))}
                                disabled={receiverSame}
                                className={[
                                    "rounded-2xl border px-3 py-3 text-sm font-semibold outline-none",
                                    receiverSame
                                        ? "border-slate-200 bg-slate-50 text-slate-400"
                                        : "border-slate-200 bg-white text-slate-900",
                                ].join(" ")}
                            />
                        </div>
                    </div>
                </div>
            </section>

            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">픽업 정보</div>

                <div className="mt-3 grid gap-3">
                    <label className="grid gap-1">
                        <span className="text-[12px] font-semibold text-slate-600">픽업 예정일시</span>
                        <input
                            type="datetime-local"
                            value={pickupAt}
                            onChange={(e) => setPickupAt(e.target.value)}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
                        />
                    </label>

                    <label className="grid gap-1">
                        <span className="text-[12px] font-semibold text-slate-600">요청사항</span>
                        <input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
                            placeholder="예: 오후 6시 이후 방문 예정"
                        />
                    </label>

                    <label className="grid gap-1">
                        <span className="text-[12px] font-semibold text-slate-600">메모</span>
                        <textarea
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            rows={3}
                            className="resize-none rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
                            placeholder="관리자 확인용 메모"
                        />
                    </label>
                </div>
            </section>

            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">주문 금액</div>

                <div className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
                    <Row label="상품 금액" value={`${subtotal.toLocaleString()}원`} />
                    <div className="h-px bg-slate-200" />
                    <Row label="현장 결제 예정 금액" value={`${subtotal.toLocaleString()}원`} strong />
                </div>

                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] font-semibold text-amber-700">
                    이 주문은 온라인 선결제가 아니라 매장 방문 후 오프라인 결제로 처리됩니다.
                </div>
            </section>

            <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur">
                <div className="mx-auto max-w-[520px] px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-[11px] font-semibold text-slate-500">현장 결제 예정 금액</div>
                            <div className="mt-0.5 text-[16px] font-extrabold text-slate-900">
                                {subtotal.toLocaleString()}원
                            </div>
                        </div>

                        <button
                            type="button"
                            disabled={!canSubmit}
                            onClick={submitOrder}
                            className={[
                                "rounded-2xl px-5 py-3 text-center text-sm font-extrabold",
                                canSubmit
                                    ? "bg-red-500 text-white hover:opacity-90"
                                    : "bg-slate-200 text-slate-500",
                            ].join(" ")}
                        >
                            {submitting ? "주문 처리 중..." : "주문하기"}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}

function Row({
                 label,
                 value,
                 strong,
             }: {
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div className="flex items-center justify-between">
            <span className={strong ? "font-extrabold text-slate-900" : ""}>{label}</span>
            <span className={strong ? "font-extrabold text-slate-900" : ""}>{value}</span>
        </div>
    );
}