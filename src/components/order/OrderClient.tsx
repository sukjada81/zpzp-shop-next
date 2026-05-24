// src/components/order/OrderClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartProvider";
import { endpoints } from "@/lib/api/endpoints";
import { saveGuestOrderRef } from "@/lib/orders/guestOrderRefs";
import { readQuickOrderProfile } from "@/lib/profile/quickOrderProfile";

export type OrderItem = {
    id: string;
    title: string;
    price: number;
    qty: number;
    metaRight?: string;
    optionId?: number | string;
    optionName?: string;
    qtyType?: number;
    stockQty?: number;
    soldout?: boolean;
    stockNote?: string;
};

type CreateOrderResponse = {
    ok: boolean;
    orderNum?: string;
    status?: number;
    statusLabel?: string;
    message?: string;
};

type AuthSessionResponse = {
    ok?: boolean;
    loggedIn?: boolean;
    member?: {
        uid?: string | number;
        id?: string;
        name?: string;
        email?: string;
        phone?: string;
        tenantSlug?: string;
    } | null;
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

function buildLoginHref(tenant: string, returnTo: string) {
    return `/${tenant}/login?returnTo=${encodeURIComponent(returnTo)}`;
}

function getMaxSelectableQty(item?: { qtyType?: number; stockQty?: number }) {
    if (!item) return Number.POSITIVE_INFINITY;
    if (Number(item.qtyType ?? 1) === 1) return Number.POSITIVE_INFINITY;
    const qty = Number(item.stockQty ?? 0);
    return qty > 0 ? qty : 0;
}

async function fetchAuthSession(): Promise<AuthSessionResponse | null> {
    try {
        const res = await fetch("/auth/session", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
                Accept: "application/json",
            },
        });

        if (!res.ok) return null;
        return (await res.json().catch(() => null)) as AuthSessionResponse | null;
    } catch {
        return null;
    }
}

export default function OrderClient(props: {
    tenant: string;
    initialItems?: OrderItem[];
}) {
    const { tenant } = props;
    const router = useRouter();
    const pathname = usePathname();
    const cart = useCart();

    const initialItems = props.initialItems ?? [];

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

    useEffect(() => {
        const profile = readQuickOrderProfile(tenant);
        if (!profile) return;

        const nickname = String(profile.nickname ?? "").trim();
        const phone = onlyDigits(String(profile.phone ?? ""));

        if (nickname) {
            setBuyerName((prev) => prev || nickname);
            setReceiverName((prev) => prev || nickname);
        }

        if (phone.length >= 10) {
            const a = phone.slice(0, 3);
            const b = phone.length === 10 ? phone.slice(3, 6) : phone.slice(3, 7);
            const c = phone.length === 10 ? phone.slice(6, 10) : phone.slice(7, 11);

            setBuyerPhoneA((prev) => prev || a || "010");
            setBuyerPhoneB((prev) => prev || b);
            setBuyerPhoneC((prev) => prev || c);

            setReceiverPhoneA((prev) => prev || a || "010");
            setReceiverPhoneB((prev) => prev || b);
            setReceiverPhoneC((prev) => prev || c);
        }
    }, [tenant]);

    // 로컬 저장값이 없으면 DB(세션)에서 주문자명/연락처를 채운다 (다른 기기/브라우저 대응)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/auth/session", { cache: "no-store" });
                const data = await res.json().catch(() => null);
                if (cancelled || !data?.loggedIn || !data?.member) return;

                const name = String(data.member.name ?? "").trim();
                const phone = onlyDigits(String(data.member.phone ?? ""));

                if (name) {
                    setBuyerName((prev) => prev || name);
                    setReceiverName((prev) => prev || name);
                }

                if (phone.length >= 10) {
                    const a = phone.slice(0, 3);
                    const b = phone.length === 10 ? phone.slice(3, 6) : phone.slice(3, 7);
                    const c = phone.length === 10 ? phone.slice(6, 10) : phone.slice(7, 11);

                    setBuyerPhoneA((prev) => prev || a || "010");
                    setBuyerPhoneB((prev) => prev || b);
                    setBuyerPhoneC((prev) => prev || c);

                    setReceiverPhoneA((prev) => prev || a || "010");
                    setReceiverPhoneB((prev) => prev || b);
                    setReceiverPhoneC((prev) => prev || c);
                }
            } catch {
                // 세션 조회 실패 시 무시 (로컬값/수동입력 사용)
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [tenant]);

    const items = useMemo<OrderItem[]>(() => {
        if (initialItems.length > 0) {
            return initialItems;
        }

        if (cart.items && cart.items.length > 0) {
            return cart.items.map((item) => ({
                id: String(item.productId),
                title: item.name,
                price: Number(item.price ?? 0),
                qty: Number(item.quantity ?? 0),
                optionId: item.optionId,
                optionName: item.optionName,
                qtyType: item.qtyType,
                stockQty: item.stockQty,
                soldout: item.soldout,
                stockNote: item.stockNote,
            }));
        }

        return [];
    }, [initialItems, cart.items]);

    const subtotal = useMemo(
        () => items.reduce((sum, it) => sum + Number(it.price ?? 0) * Number(it.qty ?? 0), 0),
        [items]
    );

    const canSubmit = items.length > 0 && !submitting;
    const isDirectOrder = initialItems.length > 0;

    function redirectToLogin() {
        const returnTo = pathname || `/${tenant}/order`;
        alert("로그인이 필요합니다. 다시 로그인해 주세요.");
        router.push(buildLoginHref(tenant, returnTo));
    }

    function updateQty(index: number, next: number) {
        const target = items[index];
        if (!target) return;
        if (isDirectOrder) return;

        const safeQty = Math.max(0, next);
        const optionKey =
            target.optionId != null && String(target.optionId).trim() !== ""
                ? `id:${String(target.optionId)}`
                : target.optionName
                    ? `name:${target.optionName}`
                    : "default";

        cart.updateQuantity(String(target.id), safeQty, optionKey);
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

        if (!normalizedBuyerPhone || normalizedBuyerPhone.length < 10) {
            alert("주문자 연락처를 정확히 입력해 주세요.");
            return;
        }

        if (!normalizedReceiverName) {
            alert("수령인 이름을 입력해 주세요.");
            return;
        }

        if (!normalizedReceiverPhone || normalizedReceiverPhone.length < 10) {
            alert("수령인 연락처를 정확히 입력해 주세요.");
            return;
        }

        if (!items.length) {
            alert("주문할 상품이 없습니다.");
            return;
        }

        setSubmitting(true);

        try {
            const auth = await fetchAuthSession();
            if (!auth?.loggedIn || !auth?.member?.uid) {
                redirectToLogin();
                return;
            }

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
                    direct: isDirectOrder ? 1 : 0,
                    items: items.map((it) => ({
                        productId: Number(it.id),
                        optionId:
                            it.optionId != null && String(it.optionId).trim() !== ""
                                ? Number(it.optionId)
                                : undefined,
                        optionName: it.optionName ?? "",
                        qty: Number(it.qty ?? 0),
                    })),
                }),
            });

            const json = (await res.json().catch(() => ({}))) as CreateOrderResponse;

            if (res.status === 401) {
                redirectToLogin();
                return;
            }

            if (!res.ok || json?.ok === false || !json?.orderNum) {
                throw new Error(json?.message || `주문 생성 실패 (HTTP ${res.status})`);
            }

            const orderNum = json.orderNum;

            saveGuestOrderRef({
                tenant,
                orderNum,
                phone: normalizedBuyerPhone,
                buyerName: normalizedBuyerName,
                createdAt: new Date().toISOString(),
            });

            if (!isDirectOrder) {
                cart.clear();
            }

            router.replace(`/${tenant}/orders?highlight=${encodeURIComponent(orderNum)}`);
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
                        {items.map((it, index) => {
                            const maxQty = getMaxSelectableQty(it);
                            const isMaxReached =
                                maxQty !== Number.POSITIVE_INFINITY && Number(it.qty ?? 0) >= maxQty;

                            return (
                                <div
                                    key={`${it.id}:${String(it.optionId ?? "")}:${String(it.optionName ?? "")}:${index}`}
                                    className="rounded-2xl border border-slate-200 p-3"
                                >
                                    <div className="line-clamp-2 text-[14px] font-extrabold text-slate-900">
                                        {it.title}
                                    </div>

                                    {it.optionName ? (
                                        <div className="mt-1 text-[12px] font-semibold text-slate-500">
                                            옵션: {it.optionName}
                                        </div>
                                    ) : null}

                                    {it.stockNote ? (
                                        <div className="mt-1 text-[12px] font-semibold text-slate-500">
                                            {it.stockNote}
                                        </div>
                                    ) : null}

                                    <div className="mt-3 flex items-center justify-between gap-3">
                                        <div className="text-[14px] font-extrabold text-slate-900">
                                            {(Number(it.price ?? 0) * Number(it.qty ?? 0)).toLocaleString()}원
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => updateQty(index, Number(it.qty ?? 0) - 1)}
                                                disabled={submitting || isDirectOrder}
                                                className="h-8 w-8 rounded-full border border-slate-200 text-sm font-bold text-slate-700 disabled:opacity-40"
                                            >
                                                -
                                            </button>
                                            <div className="min-w-[28px] text-center text-sm font-extrabold text-slate-900">
                                                {it.qty}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => updateQty(index, Number(it.qty ?? 0) + 1)}
                                                disabled={submitting || isDirectOrder || !!it.soldout || isMaxReached}
                                                className="h-8 w-8 rounded-full border border-slate-200 text-sm font-bold text-slate-700 disabled:opacity-40"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-[14px] font-bold text-slate-700">
                        <span>총 결제 금액</span>
                        <span className="text-[18px] font-extrabold text-slate-900">
                            {subtotal.toLocaleString()}원
                        </span>
                    </div>
                </div>
            </section>

            <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[16px] font-extrabold text-slate-900">주문자 정보</div>

                <div className="mt-3 space-y-3">
                    <input
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="주문자 이름"
                        className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none"
                    />
                    <div className="grid grid-cols-3 gap-2">
                        <input
                            value={buyerPhoneA}
                            onChange={(e) => setBuyerPhoneA(onlyDigits(e.target.value).slice(0, 3))}
                            className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none"
                        />
                        <input
                            value={buyerPhoneB}
                            onChange={(e) => setBuyerPhoneB(onlyDigits(e.target.value).slice(0, 4))}
                            className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none"
                        />
                        <input
                            value={buyerPhoneC}
                            onChange={(e) => setBuyerPhoneC(onlyDigits(e.target.value).slice(0, 4))}
                            className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none"
                        />
                    </div>
                    <div className="text-[12px] font-semibold text-slate-500">
                        입력 연락처: {buyerPhonePreview || "-"}
                    </div>
                </div>
            </section>

            <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="text-[16px] font-extrabold text-slate-900">수령인 정보</div>
                    <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-600">
                        <input
                            type="checkbox"
                            checked={receiverSame}
                            onChange={(e) => setReceiverSame(e.target.checked)}
                        />
                        주문자와 동일
                    </label>
                </div>

                <div className="mt-3 space-y-3">
                    <input
                        value={receiverSame ? buyerName : receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                        placeholder="수령인 이름"
                        disabled={receiverSame}
                        className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none disabled:bg-slate-50"
                    />
                    <div className="grid grid-cols-3 gap-2">
                        <input
                            value={receiverSame ? buyerPhoneA : receiverPhoneA}
                            onChange={(e) => setReceiverPhoneA(onlyDigits(e.target.value).slice(0, 3))}
                            disabled={receiverSame}
                            className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none disabled:bg-slate-50"
                        />
                        <input
                            value={receiverSame ? buyerPhoneB : receiverPhoneB}
                            onChange={(e) => setReceiverPhoneB(onlyDigits(e.target.value).slice(0, 4))}
                            disabled={receiverSame}
                            className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none disabled:bg-slate-50"
                        />
                        <input
                            value={receiverSame ? buyerPhoneC : receiverPhoneC}
                            onChange={(e) => setReceiverPhoneC(onlyDigits(e.target.value).slice(0, 4))}
                            disabled={receiverSame}
                            className="h-12 rounded-2xl border border-slate-200 px-4 text-sm outline-none disabled:bg-slate-50"
                        />
                    </div>
                    <div className="text-[12px] font-semibold text-slate-500">
                        입력 연락처: {receiverPhonePreview || "-"}
                    </div>
                </div>
            </section>

            <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[16px] font-extrabold text-slate-900">픽업/요청사항</div>

                <div className="mt-3 space-y-3">
                    <input
                        type="datetime-local"
                        value={pickupAt}
                        onChange={(e) => setPickupAt(e.target.value)}
                        className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none"
                    />
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="요청사항"
                        rows={3}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
                    />
                    <textarea
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        placeholder="관리자 메모"
                        rows={3}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
                    />
                </div>
            </section>

            <button
                type="button"
                onClick={submitOrder}
                disabled={!canSubmit}
                className="mt-5 w-full rounded-2xl bg-[color:var(--accent)] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"
            >
                {submitting ? "주문 처리 중..." : "주문하기"}
            </button>
        </main>
    );
}