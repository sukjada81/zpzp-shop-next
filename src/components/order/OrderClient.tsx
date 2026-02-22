"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addOrder } from "@/lib/orders/ordersStore";
import { useCart } from "@/lib/cart/CartProvider";

export type OrderItem = {
    id: string;
    title: string;
    price: number;
    qty: number;
    metaRight?: string;
};

type PayMethod = "card" | "bank" | "kakao";

export default function OrderClient(props: {
    tenant: string;
    initialItems: OrderItem[];
}) {
    const { tenant } = props;
    const router = useRouter();

    // Cart clear를 위해 사용 (구현체 차이 대비)
    const cart = useCart() as any;

    const [items, setItems] = useState<OrderItem[]>(props.initialItems);

    // 주문자/수령(입력)
    const [buyerName, setBuyerName] = useState("현승우");
    const [buyerPhoneA, setBuyerPhoneA] = useState("010");
    const [buyerPhoneB, setBuyerPhoneB] = useState("4936");
    const [buyerPhoneC, setBuyerPhoneC] = useState("6328");

    const [receiverSame, setReceiverSame] = useState(true);
    const [receiverName, setReceiverName] = useState("현승우");
    const [receiverPhoneA, setReceiverPhoneA] = useState("010");
    const [receiverPhoneB, setReceiverPhoneB] = useState("4936");
    const [receiverPhoneC, setReceiverPhoneC] = useState("6328");

    const [addrZip, setAddrZip] = useState("");
    const [addr1, setAddr1] = useState("");
    const [addr2, setAddr2] = useState("");
    const [memo, setMemo] = useState("");

    // 쿠폰/포인트 (MVP 더미)
    const [couponTotal] = useState(1); // 사용 가능 쿠폰 1장
    const [selectedCoupon, setSelectedCoupon] = useState<string | null>(null); // 선택된 쿠폰 id
    const [couponSheetOpen, setCouponSheetOpen] = useState(false);

    const [pointAvail] = useState(1000); // 총 보유 포인트 1,000p
    const [usePoint, setUsePoint] = useState(0);

    const [payMethod, setPayMethod] = useState<PayMethod>("kakao");

    const subtotal = useMemo(
        () => items.reduce((sum, it) => sum + it.price * it.qty, 0),
        [items],
    );

    // MVP: 쿠폰은 "신규 가입쿠폰(1,000원 할인)" 1장만 있다고 가정
    const couponDiscount = useMemo(() => {
        if (!selectedCoupon) return 0;
        return 1000;
    }, [selectedCoupon]);

    const safeUsePoint = useMemo(() => {
        const max = Math.max(0, subtotal - couponDiscount);
        return Math.min(Math.max(0, usePoint), pointAvail, max);
    }, [usePoint, pointAvail, subtotal, couponDiscount]);

    const totalAfterDiscount = Math.max(0, subtotal - couponDiscount - safeUsePoint);

    const deliveryFee = 4000; // ✅ 예시처럼 기본 4,000원 (추후 정책 반영)
    const grandTotal = Math.max(0, totalAfterDiscount + (items.length > 0 ? deliveryFee : 0));

    // ✅ 0원 결제면 결제수단 무관
    const canSubmit = items.length > 0 && (grandTotal === 0 || !!payMethod);

    function updateQty(id: string, next: number) {
        setItems((prev) =>
            prev
                .map((it) => (it.id === id ? { ...it, qty: Math.max(0, next) } : it))
                .filter((it) => it.qty > 0),
        );
    }

    function buyerPhone() {
        return `${buyerPhoneA}-${buyerPhoneB}-${buyerPhoneC}`.replace(/--+/g, "-");
    }
    function receiverPhone() {
        return `${receiverPhoneA}-${receiverPhoneB}-${receiverPhoneC}`.replace(/--+/g, "-");
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

        // MVP 최소 검증
        if (!buyerName.trim() || !buyerPhoneA.trim() || !buyerPhoneB.trim() || !buyerPhoneC.trim()) {
            alert("주문자 정보를 입력해 주세요.");
            return;
        }
        if (!receiverName.trim() || !receiverPhoneA.trim() || !receiverPhoneB.trim() || !receiverPhoneC.trim()) {
            alert("수령인 정보를 입력해 주세요.");
            return;
        }
        if (!addr1.trim()) {
            alert("배송지 주소를 입력해 주세요.");
            return;
        }

        // ✅ 로컬 주문 저장 (현재 프로젝트 ordersStore 기반)
        const order = addOrder(
            tenant,
            items.map((it) => ({
                productId: it.id,
                name: it.title,
                price: it.price,
                quantity: it.qty,
            })),
        );

        // ✅ 장바구니 비우기 (구현체 호환)
        if (typeof cart?.clear === "function") cart.clear();

        // ✅ 주문내역 이동
        router.push(`/${tenant}/orders?created=${encodeURIComponent(order.orderNo)}`);
    }

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-28 pt-3">
            {/* ✅ (요청) 주문서 페이지 내부 헤더 제거: AppShell의 MobileHeader만 사용 */}

            {/* 주문 상품 */}
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

            {/* 주문자 */}
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
                        />
                    </label>

                    <div className="grid gap-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[12px] font-semibold text-slate-600">연락처 *</span>
                            <span className="text-[11px] font-semibold text-slate-400">
                알림톡/문자 수신 가능한 번호로 입력해 주세요.
              </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <input
                                value={buyerPhoneA}
                                onChange={(e) => {
                                    setBuyerPhoneA(e.target.value);
                                    if (receiverSame) setReceiverPhoneA(e.target.value);
                                }}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
                            />
                            <input
                                value={buyerPhoneB}
                                onChange={(e) => {
                                    setBuyerPhoneB(e.target.value);
                                    if (receiverSame) setReceiverPhoneB(e.target.value);
                                }}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
                            />
                            <input
                                value={buyerPhoneC}
                                onChange={(e) => {
                                    setBuyerPhoneC(e.target.value);
                                    if (receiverSame) setReceiverPhoneC(e.target.value);
                                }}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* 배송지 */}
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="text-[15px] font-extrabold text-slate-900">배송지</div>
                    <button
                        type="button"
                        className="rounded-full bg-slate-600 px-4 py-2 text-[12px] font-extrabold text-white"
                        onClick={() => alert("MVP: 배송지 불러오기 미구현")}
                    >
                        배송지 불러오기
                    </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                    <div className="text-[12px] font-semibold text-slate-600">수령인 *</div>
                    <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-500">
                        <input
                            type="checkbox"
                            checked={receiverSame}
                            onChange={(e) => syncReceiverFromBuyer(e.target.checked)}
                        />
                        주문자와 동일
                    </label>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-3">
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
                    />

                    <div className="flex items-center justify-end text-[12px] font-semibold text-slate-400">
                        {receiverSame ? "✓ 주문자와 동일" : ""}
                    </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                    <input
                        value={receiverPhoneA}
                        onChange={(e) => setReceiverPhoneA(e.target.value)}
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
                        onChange={(e) => setReceiverPhoneB(e.target.value)}
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
                        onChange={(e) => setReceiverPhoneC(e.target.value)}
                        disabled={receiverSame}
                        className={[
                            "rounded-2xl border px-3 py-3 text-sm font-semibold outline-none",
                            receiverSame
                                ? "border-slate-200 bg-slate-50 text-slate-400"
                                : "border-slate-200 bg-white text-slate-900",
                        ].join(" ")}
                    />
                </div>

                <div className="mt-4 grid gap-2">
                    <div className="text-[12px] font-semibold text-slate-600">배송지 주소 *</div>

                    <div className="grid grid-cols-[1fr_150px] gap-2">
                        <input
                            value={addrZip}
                            onChange={(e) => setAddrZip(e.target.value)}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
                            placeholder=""
                        />
                        <button
                            type="button"
                            className="rounded-2xl bg-slate-600 px-4 py-3 text-sm font-extrabold text-white"
                            onClick={() => alert("MVP: 우편번호 검색 미구현")}
                        >
                            우편번호 검색
                        </button>
                    </div>

                    <input
                        value={addr1}
                        onChange={(e) => setAddr1(e.target.value)}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
                        placeholder=""
                    />

                    <input
                        value={addr2}
                        onChange={(e) => setAddr2(e.target.value)}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
                        placeholder="상세 주소 입력"
                    />
                </div>

                <div className="mt-4 grid gap-2">
                    <div className="text-[12px] font-semibold text-slate-600">배송시 요청</div>
                    <select className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none">
                        <option>배송시 요청 사항을 선택해주세요</option>
                        <option>문 앞에 놓아주세요</option>
                        <option>부재 시 연락주세요</option>
                        <option>경비실에 맡겨주세요</option>
                    </select>

                    <textarea
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        rows={3}
                        className="resize-none rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
                        placeholder=""
                    />
                </div>
            </section>

            {/* ✅ 쿠폰/포인트 (요청 반영) */}
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mt-1 grid gap-3">
                    {/* 쿠폰 */}
                    <div className="grid grid-cols-[1fr_96px] items-end gap-3">
                        <div className="grid gap-2">
                            <div className="text-[12px] font-semibold text-slate-600">
                                사용 가능 쿠폰 {couponTotal}장 / 선택한 쿠폰 {selectedCoupon ? 1 : 0}장
                            </div>
                            <input
                                value={selectedCoupon ? "신규 가입쿠폰 (1,000원 할인)" : "0"}
                                readOnly
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => setCouponSheetOpen(true)}
                            className="h-[46px] rounded-2xl bg-slate-600 text-sm font-extrabold text-white"
                        >
                            선택
                        </button>
                    </div>

                    {/* 포인트 */}
                    <div className="grid grid-cols-[1fr_96px] items-end gap-3">
                        <div className="grid gap-2">
                            <div className="text-[12px] font-semibold text-slate-600">
                                총 보유 포인트 <span className="font-extrabold">{pointAvail.toLocaleString()} p</span>
                            </div>
                            <input
                                type="number"
                                value={safeUsePoint}
                                min={0}
                                max={pointAvail}
                                onChange={(e) => setUsePoint(Math.max(0, Number(e.target.value || 0)))}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => setUsePoint(pointAvail)}
                            className="h-[46px] rounded-2xl bg-slate-600 text-sm font-extrabold text-white"
                        >
                            전액 사용
                        </button>
                    </div>
                </div>
            </section>

            {/* 결제수단 */}
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">결제수단</div>

                {grandTotal === 0 ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] font-semibold text-slate-700">
                        총 결제금액이 0원입니다. 결제수단 선택 없이 주문 가능합니다.
                    </div>
                ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <PayBtn active={payMethod === "card"} onClickAction={() => setPayMethod("card")}>
                            신용카드
                        </PayBtn>
                        <PayBtn active={payMethod === "kakao"} onClickAction={() => setPayMethod("kakao")}>
                            카카오페이
                        </PayBtn>
                        <PayBtn active={payMethod === "bank"} onClickAction={() => setPayMethod("bank")}>
                            무통장입금
                        </PayBtn>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] font-semibold text-slate-400">
                            (MVP) 기타 결제수단은 추후 연동
                        </div>
                    </div>
                )}
            </section>

            {/* 합계 */}
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">결제 금액</div>

                <div className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
                    <Row label="상품 금액" value={`${subtotal.toLocaleString()}원`} />
                    <Row label="쿠폰 할인" value={`-${couponDiscount.toLocaleString()}원`} />
                    <Row label="포인트 사용" value={`-${safeUsePoint.toLocaleString()}원`} />
                    <Row label="기본 배송비" value={`+ ${items.length > 0 ? deliveryFee.toLocaleString() : 0}원`} />
                    <div className="h-px bg-slate-200" />
                    <Row label="총 결제 금액" value={`${grandTotal.toLocaleString()}원`} strong />
                </div>
            </section>

            {/* 하단 고정 CTA */}
            <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur">
                <div className="mx-auto max-w-[520px] px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-[11px] font-semibold text-slate-500">총 결제 금액</div>
                            <div className="mt-0.5 text-[16px] font-extrabold text-slate-900">
                                {grandTotal.toLocaleString()}원
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
                            결제하기
                        </button>
                    </div>

                    {grandTotal !== 0 && !payMethod ? (
                        <div className="mt-2 text-center text-[11px] font-semibold text-slate-500">
                            결제수단을 선택해 주세요.
                        </div>
                    ) : null}
                </div>
            </div>

            {/* ✅ 쿠폰 선택 시트 (MVP) */}
            {couponSheetOpen ? (
                <>
                    <button
                        type="button"
                        aria-label="닫기"
                        className="fixed inset-0 z-[60] bg-black/30"
                        onClick={() => setCouponSheetOpen(false)}
                    />
                    <div className="fixed bottom-0 left-0 right-0 z-[61]">
                        <div className="mx-auto max-w-[520px]">
                            <div className="rounded-t-3xl bg-white shadow-2xl">
                                <div className="flex justify-center pt-3">
                                    <div className="h-1.5 w-10 rounded-full bg-slate-200" />
                                </div>

                                <div className="px-4 pb-4 pt-3">
                                    <div className="text-center text-[14px] font-extrabold text-slate-900">
                                        쿠폰 사용
                                    </div>

                                    <div className="mt-4 text-[12px] font-semibold text-slate-600">
                                        {items[0]?.title ?? "상품"}
                                    </div>

                                    <select
                                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
                                        value={selectedCoupon ?? ""}
                                        onChange={(e) => setSelectedCoupon(e.target.value || null)}
                                    >
                                        <option value="">쿠폰 선택 안함</option>
                                        <option value="welcome-1000">신규 가입쿠폰 (1,000원 할인)</option>
                                    </select>

                                    <div className="mt-6 grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            className="h-12 rounded-2xl bg-slate-600 text-sm font-extrabold text-white"
                                            onClick={() => {
                                                // 취소: 선택값을 유지하지 않으려면 아래 주석 해제
                                                // setSelectedCoupon(null);
                                                setCouponSheetOpen(false);
                                            }}
                                        >
                                            취소
                                        </button>
                                        <button
                                            type="button"
                                            className="h-12 rounded-2xl bg-red-500 text-sm font-extrabold text-white"
                                            onClick={() => setCouponSheetOpen(false)}
                                        >
                                            적용
                                        </button>
                                    </div>

                                    <div className="pb-2" />
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}
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

function PayBtn({
                    active,
                    onClickAction,
                    children,
                }: {
    active: boolean;
    onClickAction: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClickAction}
            className={[
                "rounded-2xl border px-3 py-3 text-sm font-extrabold transition",
                active
                    ? "border-[color:var(--brand)] bg-[color:var(--brand-weak)] text-[color:var(--brand)]"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            ].join(" ")}
        >
            {children}
        </button>
    );
}