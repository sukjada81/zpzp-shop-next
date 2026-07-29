// src/components/order/OrderClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart/CartProvider";
import { endpoints, tenantHeader } from "@/lib/api/endpoints";
import { persistQuickOrderProfile, readQuickOrderProfile } from "@/lib/profile/quickOrderProfile";
import { initTossPayment } from "@/lib/toss/client";
import DaumPostcodeSearch from "@/components/order/DaumPostcodeSearch";

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

/** Toss requestPayment customerMobilePhone — 숫자만, 8~11자리 */
function formatTossMobilePhone(phone: string) {
    const digits = onlyDigits(phone);
    if (digits.length < 8) return undefined;
    return digits.slice(0, 11);
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

const ORDER_DRAFT_KEY = (tenant: string) => `zpzp_order_draft_${tenant}`;

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
    const searchParams = useSearchParams();
    const cart = useCart();

    const initialItems = props.initialItems ?? [];

    const [draftItems, setDraftItems] = useState<OrderItem[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [payError, setPayError] = useState("");

    const [buyerName, setBuyerName] = useState("");
    const [buyerPhoneA, setBuyerPhoneA] = useState("010");
    const [buyerPhoneB, setBuyerPhoneB] = useState("");
    const [buyerPhoneC, setBuyerPhoneC] = useState("");
    const [buyerPostcode, setBuyerPostcode] = useState("");
    const [buyerAddress1, setBuyerAddress1] = useState("");
    const [buyerAddress2, setBuyerAddress2] = useState("");

    const [receiverSame, setReceiverSame] = useState(true);
    const [receiverName, setReceiverName] = useState("");
    const [receiverPhoneA, setReceiverPhoneA] = useState("010");
    const [receiverPhoneB, setReceiverPhoneB] = useState("");
    const [receiverPhoneC, setReceiverPhoneC] = useState("");

    const [postcode, setPostcode] = useState("");
    const [address1, setAddress1] = useState("");
    const [address2, setAddress2] = useState("");

    function applyBuyerAddress(next: { postcode?: string; address1?: string; address2?: string }) {
        const nextPostcode = String(next.postcode ?? "").trim();
        const nextAddress1 = String(next.address1 ?? "").trim();
        const nextAddress2 = String(next.address2 ?? "").trim();

        if (nextPostcode) setBuyerPostcode((prev) => prev || nextPostcode);
        if (nextAddress1) setBuyerAddress1((prev) => prev || nextAddress1);
        if (nextAddress2) setBuyerAddress2((prev) => prev || nextAddress2);

        if (receiverSame) {
            if (nextPostcode) setPostcode((prev) => prev || nextPostcode);
            if (nextAddress1) setAddress1((prev) => prev || nextAddress1);
            if (nextAddress2) setAddress2((prev) => prev || nextAddress2);
        }
    }

    function syncDeliveryFromBuyer(
        nextPostcode = buyerPostcode,
        nextAddress1 = buyerAddress1,
        nextAddress2 = buyerAddress2
    ) {
        setPostcode(nextPostcode);
        setAddress1(nextAddress1);
        setAddress2(nextAddress2);
    }

    const buildBuyerProfile = useCallback(() => {
        const existing = readQuickOrderProfile(tenant);
        return {
            nickname: buyerName.trim(),
            phone: joinPhone(buyerPhoneA, buyerPhoneB, buyerPhoneC),
            recommenderNickname: String(existing?.recommenderNickname ?? "").trim(),
            postcode: buyerPostcode.trim(),
            address1: buyerAddress1.trim(),
            address2: buyerAddress2.trim(),
        };
    }, [
        tenant,
        buyerName,
        buyerPhoneA,
        buyerPhoneB,
        buyerPhoneC,
        buyerPostcode,
        buyerAddress1,
        buyerAddress2,
    ]);

    const persistBuyerProfile = useCallback(async () => {
        const profile = buildBuyerProfile();
        const hasCore =
            !!profile.nickname ||
            profile.phone.length >= 10 ||
            !!profile.address1;
        if (!hasCore) return;
        await persistQuickOrderProfile(tenant, profile);
    }, [tenant, buildBuyerProfile]);

    // 주문자 정보(이름·연락처·주소) 입력 시 프로필에 저장 → 다음 주문·내 정보 설정에서 재사용
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void persistBuyerProfile();
        }, 600);
        return () => window.clearTimeout(timer);
    }, [persistBuyerProfile]);

    // 줍줍은 배송 전용, 정책 변경 대비 보존 — 픽업 희망일시 입력 비활성(주문 시 pickupAt=null 전송)
    // const [pickupAt, setPickupAt] = useState(nowLocalDateTimeInputValue());
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

        applyBuyerAddress({
            postcode: profile.postcode,
            address1: profile.address1,
            address2: profile.address2,
        });
    }, [tenant]);

    // 로컬 저장값이 없으면 DB(세션)에서 주문자명/연락처/주소를 채운다 (다른 기기/브라우저 대응)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/auth/session", { cache: "no-store" });
                const data = await res.json().catch(() => null);
                if (cancelled || !data?.loggedIn || !data?.member) return;

                const member = data.member as {
                    name?: string;
                    phone?: string;
                    postcode?: string;
                    address1?: string;
                    address2?: string;
                };

                const name = String(member.name ?? "").trim();
                const phone = onlyDigits(String(member.phone ?? ""));

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

                applyBuyerAddress({
                    postcode: member.postcode,
                    address1: member.address1,
                    address2: member.address2,
                });

                const profileRes = await fetch("/api/proxy/v1/public/member/profile", {
                    cache: "no-store",
                    headers: tenantHeader(tenant),
                });
                const profileData = await profileRes.json().catch(() => null);
                if (cancelled || !profileData?.ok || !profileData?.profile) return;

                const dbProfile = profileData.profile as {
                    nickname?: string;
                    phone?: string;
                    postcode?: string;
                    address1?: string;
                    address2?: string;
                };

                const dbName = String(dbProfile.nickname ?? "").trim();
                const dbPhone = onlyDigits(String(dbProfile.phone ?? ""));

                if (dbName) {
                    setBuyerName((prev) => prev || dbName);
                    setReceiverName((prev) => prev || dbName);
                }

                if (dbPhone.length >= 10) {
                    const a = dbPhone.slice(0, 3);
                    const b = dbPhone.length === 10 ? dbPhone.slice(3, 6) : dbPhone.slice(3, 7);
                    const c = dbPhone.length === 10 ? dbPhone.slice(6, 10) : dbPhone.slice(7, 11);

                    setBuyerPhoneA((prev) => prev || a || "010");
                    setBuyerPhoneB((prev) => prev || b);
                    setBuyerPhoneC((prev) => prev || c);

                    setReceiverPhoneA((prev) => prev || a || "010");
                    setReceiverPhoneB((prev) => prev || b);
                    setReceiverPhoneC((prev) => prev || c);
                }

                applyBuyerAddress({
                    postcode: dbProfile.postcode,
                    address1: dbProfile.address1,
                    address2: dbProfile.address2,
                });
            } catch {
                // 세션 조회 실패 시 무시 (로컬값/수동입력 사용)
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [tenant]);

    // 상품상세 "주문하기" → PG 주문서로 넘길 때 sessionStorage 임시 보관
    useEffect(() => {
        if (searchParams.get("direct") !== "1") return;
        try {
            const raw = sessionStorage.getItem(ORDER_DRAFT_KEY(tenant));
            if (!raw) return;
            const parsed = JSON.parse(raw) as OrderItem[];
            if (Array.isArray(parsed) && parsed.length > 0) {
                setDraftItems(parsed);
            }
            sessionStorage.removeItem(ORDER_DRAFT_KEY(tenant));
        } catch {
            // ignore malformed draft
        }
    }, [tenant, searchParams]);

    const items = useMemo<OrderItem[]>(() => {
        if (draftItems.length > 0) {
            return draftItems;
        }

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
    }, [draftItems, initialItems, cart.items]);

    const subtotal = useMemo(
        () => items.reduce((sum, it) => sum + Number(it.price ?? 0) * Number(it.qty ?? 0), 0),
        [items]
    );

    const canSubmit = items.length > 0 && !submitting;
    const isDirectOrder = draftItems.length > 0 || initialItems.length > 0;

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

    /**
     * Toss PG 결제 제출
     * 1) prepare API — 서버 금액 검증 + mallRN_toss_prepare 저장
     * 2) Toss SDK requestPayment — 결제창
     * 3) successUrl → /order/payment/confirm → confirm API → 주문 생성
     * (장바구니 비우기는 confirm 성공 후 orders 페이지에서 처리)
     */
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

        const normalizedPostcode = (receiverSame ? buyerPostcode : postcode).trim();
        const normalizedAddress1 = (receiverSame ? buyerAddress1 : address1).trim();
        const normalizedAddress2 = (receiverSame ? buyerAddress2 : address2).trim();

        if (!normalizedAddress1) {
            alert("배송지 주소를 입력해 주세요.");
            return;
        }

        if (!items.length) {
            alert("주문할 상품이 없습니다.");
            return;
        }

        if (subtotal <= 0) {
            alert("결제 금액이 올바르지 않습니다.");
            return;
        }

        setSubmitting(true);
        setPayError("");

        try {
            await persistBuyerProfile();

            const auth = await fetchAuthSession();
            if (!auth?.loggedIn || !auth?.member?.uid) {
                redirectToLogin();
                return;
            }

            const orderPayload = {
                buyerName: normalizedBuyerName,
                buyerPhone: normalizedBuyerPhone,
                receiverName: normalizedReceiverName,
                receiverPhone: normalizedReceiverPhone,
                postcode: normalizedPostcode,
                address1: normalizedAddress1,
                address2: normalizedAddress2,
                pickupAt: null,
                message: message.trim(),
                memo: memo.trim(),
                direct: isDirectOrder ? 1 : 0,
                amount: subtotal,
                items: items.map((it) => ({
                    productId: Number(it.id),
                    optionId:
                        it.optionId != null && String(it.optionId).trim() !== ""
                            ? Number(it.optionId)
                            : undefined,
                    optionName: it.optionName ?? "",
                    qty: Number(it.qty ?? 0),
                })),
            };

            // 1. 서버-side 금액·상품 검증 (shop-php toss_prepare.php 와 동일 역할)
            const prepareRes = await fetch(endpoints.tossPrepare(tenant), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    // 링커 서브도메인에서 호스트가 경로 tenant 를 덮어써 400 이 나므로 명시 전송
                    ...tenantHeader(tenant),
                },
                credentials: "include",
                cache: "no-store",
                body: JSON.stringify(orderPayload),
            });

            const prepareJson = (await prepareRes.json().catch(() => ({}))) as {
                ok?: boolean;
                msg?: string;
                message?: string;
                orderId?: string;
                amount?: number;
            };

            if (prepareRes.status === 401) {
                redirectToLogin();
                return;
            }

            const orderId = prepareJson?.orderId || "";
            const payAmount = Number(prepareJson?.amount ?? subtotal) || subtotal;

            if (!prepareRes.ok || prepareJson?.ok !== true || !orderId) {
                throw new Error(
                    prepareJson?.msg ||
                        prepareJson?.message ||
                        `결제 준비 실패 (HTTP ${prepareRes.status})`
                );
            }

            // 2. Toss 결제창 — success/fail URL 은 tenant 서브도메인 기준
            const payment = await initTossPayment(tenant);

            const customerMobilePhone = formatTossMobilePhone(normalizedBuyerPhone);

            await payment.requestPayment({
                method: "CARD",
                amount: { currency: "KRW", value: payAmount },
                orderId,
                orderName: "주문결제",
                successUrl: `${window.location.origin}/${tenant}/order/payment/confirm`,
                failUrl: `${window.location.origin}/${tenant}/order/payment/fail`,
                customerName: normalizedBuyerName,
                customerEmail: String(auth.member?.email ?? "guest@example.com"),
                ...(customerMobilePhone ? { customerMobilePhone } : {}),
                card: { flowMode: "DEFAULT" },
            });
        } catch (e: any) {
            const errMsg = e?.message || "결제 처리 중 오류가 발생했습니다.";
            setPayError(errMsg);
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

                    <div className="pt-1">
                        <div className="text-[13px] font-bold text-slate-700">주문자 주소</div>
                        <div className="mt-2 space-y-3">
                            <div className="flex gap-2">
                                <input
                                    value={buyerPostcode}
                                    readOnly
                                    placeholder="우편번호"
                                    className="h-12 w-28 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                                />
                                <DaumPostcodeSearch
                                    disabled={submitting}
                                    onSelect={(result) => {
                                        setBuyerPostcode(result.postcode);
                                        setBuyerAddress1(result.address1);
                                        if (receiverSame) {
                                            syncDeliveryFromBuyer(result.postcode, result.address1, buyerAddress2);
                                        }
                                        const existing = readQuickOrderProfile(tenant);
                                        void persistQuickOrderProfile(tenant, {
                                            nickname: buyerName.trim(),
                                            phone: joinPhone(buyerPhoneA, buyerPhoneB, buyerPhoneC),
                                            recommenderNickname: String(existing?.recommenderNickname ?? "").trim(),
                                            postcode: result.postcode,
                                            address1: result.address1,
                                            address2: buyerAddress2.trim(),
                                        });
                                    }}
                                    className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-extrabold text-slate-800 disabled:opacity-40"
                                />
                            </div>

                            <input
                                value={buyerAddress1}
                                readOnly
                                placeholder="기본 주소 (주소 검색으로 입력)"
                                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                            />

                            <input
                                value={buyerAddress2}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setBuyerAddress2(next);
                                    if (receiverSame) {
                                        setAddress2(next);
                                    }
                                }}
                                placeholder="상세 주소 (동·호수 등)"
                                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none"
                            />
                        </div>
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
                            onChange={(e) => {
                                const checked = e.target.checked;
                                setReceiverSame(checked);
                                if (checked) {
                                    syncDeliveryFromBuyer();
                                    void persistBuyerProfile();
                                }
                            }}
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
                <div className="text-[16px] font-extrabold text-slate-900">배송지</div>
                {receiverSame ? (
                    <div className="mt-2 text-[12px] font-semibold text-slate-500">
                        주문자와 동일한 주소로 배송됩니다.
                    </div>
                ) : null}

                <div className="mt-3 space-y-3">
                    <div className="flex gap-2">
                        <input
                            value={receiverSame ? buyerPostcode : postcode}
                            readOnly
                            placeholder="우편번호"
                            className="h-12 w-28 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                        />
                        <DaumPostcodeSearch
                            disabled={submitting || receiverSame}
                            onSelect={(result) => {
                                setPostcode(result.postcode);
                                setAddress1(result.address1);
                            }}
                            className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-extrabold text-slate-800 disabled:opacity-40"
                        />
                    </div>

                    <input
                        value={receiverSame ? buyerAddress1 : address1}
                        readOnly
                        placeholder="기본 주소 (주소 검색으로 입력)"
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none"
                    />

                    <input
                        value={receiverSame ? buyerAddress2 : address2}
                        onChange={(e) => setAddress2(e.target.value)}
                        disabled={receiverSame}
                        placeholder="상세 주소 (동·호수 등)"
                        className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none disabled:bg-slate-50"
                    />
                </div>
            </section>

            <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                {/* 줍줍은 배송 전용, 정책 변경 대비 보존 — 섹션명에서 "픽업" 제거 */}
                <div className="text-[16px] font-extrabold text-slate-900">요청사항</div>

                <div className="mt-3 space-y-3">
                    {/* 줍줍은 배송 전용, 정책 변경 대비 보존 — 픽업 희망일시 입력 노출 중단
                        (pickupAt state는 유지하며 주문 생성 시 null로 전송됨 → API 스키마 무영향)
                    <input
                        type="datetime-local"
                        value={pickupAt}
                        onChange={(e) => setPickupAt(e.target.value)}
                        className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none"
                    />
                    */}
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

            <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[16px] font-extrabold text-slate-900">결제수단</div>
                <div className="mt-3 rounded-2xl border-2 border-[color:var(--accent)] bg-[color:var(--accent)]/5 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
                            💳
                        </div>
                        <div>
                            <div className="text-[14px] font-extrabold text-slate-900">
                                토스페이먼츠
                            </div>
                            <div className="mt-0.5 text-[12px] font-semibold text-slate-600">
                                카드 · 계좌이체 · 간편결제 (토스페이, 카카오페이 등)
                            </div>
                        </div>
                    </div>
                </div>
                <p className="mt-3 text-[12px] font-semibold leading-5 text-slate-500">
                    아래 버튼을 누르면 토스 결제창이 열립니다. 결제 완료 후 주문내역으로 이동합니다.
                </p>
            </section>

            <button
                type="button"
                onClick={submitOrder}
                disabled={!canSubmit}
                className="mt-5 w-full rounded-2xl bg-[color:var(--accent)] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"
            >
                {submitting ? "결제 준비 중..." : `${subtotal.toLocaleString()}원 결제하기`}
            </button>

            {payError ? (
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-[13px] font-semibold text-red-700">
                    {payError}
                </div>
            ) : null}
        </main>
    );
}