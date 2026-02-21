// src/components/order/OrderClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type OrderItem = {
    id: string;
    title: string;
    price: number;
    qty: number;
    metaRight?: string;
};

type PayMethod = "card" | "bank" | "kakao" | "tdmoney" | "tdpoint";

export default function OrderClient(props: {
    tenant: string;
    initialItems: OrderItem[];
}) {
    const { tenant } = props;
    const router = useRouter();

    const [items] = useState<OrderItem[]>(props.initialItems);

    // 주문자/수령(더미)
    const [buyerName, setBuyerName] = useState("홍길동");
    const [buyerPhone, setBuyerPhone] = useState("010-0000-0000");
    const [memo, setMemo] = useState("");

    // 포인트/머니(더미)
    const [tdMoneyAvail] = useState(12000);
    const [tdPointAvail] = useState(5000);

    const [useTdMoney, setUseTdMoney] = useState(0);
    const [useTdPoint, setUseTdPoint] = useState(0);

    const [payMethod, setPayMethod] = useState<PayMethod>("kakao");

    const subtotal = useMemo(
        () => items.reduce((sum, it) => sum + it.price * it.qty, 0),
        [items],
    );

    // ✅ TD포인트는 결제금액의 50%를 넘지 못함(요구사항 반영)
    const maxPointUsable = useMemo(() => Math.floor(subtotal * 0.5), [subtotal]);
    const pointCap = Math.min(tdPointAvail, maxPointUsable);

    const safeUseTdPoint = Math.min(useTdPoint, pointCap);
    const safeUseTdMoney = Math.min(useTdMoney, tdMoneyAvail);

    const discount = safeUseTdMoney + safeUseTdPoint;
    const total = Math.max(0, subtotal - discount);

    // ✅ 0원 결제면 결제수단 무관하게 주문 가능
    const canSubmit = items.length > 0 && (total === 0 || !!payMethod);

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-28 pt-3">
            {/* 상단 */}
            <div className="flex items-center justify-between">
                <Link
                    href={`/${tenant}/cart`}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                    ← 장바구니
                </Link>

                <div className="text-sm font-extrabold text-slate-900">주문서</div>

                <Link
                    href={`/${tenant}/home`}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                    홈 →
                </Link>
            </div>

            {/* 주문 상품 */}
            <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="text-[15px] font-extrabold text-slate-900">
                        주문 상품
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
            {items.length}개
          </span>
                </div>

                <div className="mt-3 space-y-3">
                    {items.map((it) => (
                        <div key={it.id} className="rounded-2xl border border-slate-200 p-3">
                            <div className="line-clamp-2 text-[13px] font-extrabold text-slate-900">
                                {it.title}
                            </div>

                            <div className="mt-2 flex items-end justify-between">
                                <div className="text-[13px] font-extrabold text-slate-900">
                                    {(it.price * it.qty).toLocaleString()}원
                                    <span className="ml-2 text-[11px] font-semibold text-slate-500">
                    x {it.qty}
                  </span>
                                </div>
                                <div className="text-[11px] font-semibold text-slate-500">
                                    {it.metaRight ?? ""}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 주문자 정보 */}
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">
                    주문자 정보
                </div>

                <div className="mt-3 grid gap-3">
                    <label className="grid gap-1">
            <span className="text-[12px] font-semibold text-slate-600">
              이름
            </span>
                        <input
                            value={buyerName}
                            onChange={(e) => setBuyerName(e.target.value)}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-300"
                        />
                    </label>

                    <label className="grid gap-1">
            <span className="text-[12px] font-semibold text-slate-600">
              휴대폰
            </span>
                        <input
                            value={buyerPhone}
                            onChange={(e) => setBuyerPhone(e.target.value)}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-300"
                        />
                    </label>

                    <label className="grid gap-1">
            <span className="text-[12px] font-semibold text-slate-600">
              요청사항
            </span>
                        <textarea
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            rows={3}
                            className="resize-none rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-300"
                            placeholder="예) 방문 전에 연락 부탁드려요"
                        />
                    </label>
                </div>
            </section>

            {/* TD머니/포인트 */}
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="text-[15px] font-extrabold text-slate-900">
                        할인/적립금
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500">
                        TD포인트는 결제금액의 50%까지 사용 가능
                    </div>
                </div>

                <div className="mt-3 grid gap-3">
                    <div className="rounded-2xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                            <div className="text-[13px] font-extrabold text-slate-900">
                                TD머니
                            </div>
                            <div className="text-[12px] font-semibold text-slate-500">
                                보유 {tdMoneyAvail.toLocaleString()}원
                            </div>
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                            <input
                                type="number"
                                value={safeUseTdMoney}
                                min={0}
                                max={tdMoneyAvail}
                                onChange={(e) =>
                                    setUseTdMoney(Math.max(0, Number(e.target.value || 0)))
                                }
                                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => setUseTdMoney(tdMoneyAvail)}
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                            >
                                전액
                            </button>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                            <div className="text-[13px] font-extrabold text-slate-900">
                                TD포인트
                            </div>
                            <div className="text-[12px] font-semibold text-slate-500">
                                보유 {tdPointAvail.toLocaleString()}P / 최대{" "}
                                {pointCap.toLocaleString()}P
                            </div>
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                            <input
                                type="number"
                                value={safeUseTdPoint}
                                min={0}
                                max={pointCap}
                                onChange={(e) =>
                                    setUseTdPoint(Math.max(0, Number(e.target.value || 0)))
                                }
                                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => setUseTdPoint(pointCap)}
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                            >
                                최대
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* 결제수단 */}
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">결제수단</div>

                {total === 0 ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] font-semibold text-slate-700">
                        총 결제금액이 0원입니다. 결제수단 선택 없이 주문 가능합니다.
                    </div>
                ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <PayBtn
                            active={payMethod === "kakao"}
                            onClickAction={() => setPayMethod("kakao")}
                        >
                            카카오페이
                        </PayBtn>
                        <PayBtn
                            active={payMethod === "card"}
                            onClickAction={() => setPayMethod("card")}
                        >
                            카드결제
                        </PayBtn>
                        <PayBtn
                            active={payMethod === "bank"}
                            onClickAction={() => setPayMethod("bank")}
                        >
                            무통장입금
                        </PayBtn>
                        <PayBtn
                            active={payMethod === "tdmoney"}
                            onClickAction={() => setPayMethod("tdmoney")}
                        >
                            TD머니
                        </PayBtn>
                    </div>
                )}
            </section>

            {/* 합계 */}
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">결제 금액</div>

                <div className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
                    <Row label="상품 금액" value={`${subtotal.toLocaleString()}원`} />
                    <Row label="TD머니 사용" value={`-${safeUseTdMoney.toLocaleString()}원`} />
                    <Row label="TD포인트 사용" value={`-${safeUseTdPoint.toLocaleString()}원`} />
                    <div className="h-px bg-slate-200" />
                    <Row label="최종 결제" value={`${total.toLocaleString()}원`} strong />
                </div>
            </section>

            {/* 하단 고정 CTA */}
            <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur">
                <div className="mx-auto max-w-[520px] px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-[11px] font-semibold text-slate-500">
                                최종 결제
                            </div>
                            <div className="mt-0.5 text-[16px] font-extrabold text-slate-900">
                                {total.toLocaleString()}원
                            </div>
                        </div>

                        <button
                            type="button"
                            disabled={!canSubmit}
                            onClick={() => {
                                // ✅ UI 우선: 주문 성공 가정 후 주문내역으로 이동
                                router.push(`/${tenant}/orders`);
                            }}
                            className={[
                                "rounded-2xl px-5 py-3 text-center text-sm font-extrabold",
                                canSubmit
                                    ? "bg-[color:var(--brand)] text-white hover:opacity-90"
                                    : "bg-slate-200 text-slate-500",
                            ].join(" ")}
                        >
                            주문하기
                        </button>
                    </div>

                    {total !== 0 && !payMethod ? (
                        <div className="mt-2 text-center text-[11px] font-semibold text-slate-500">
                            결제수단을 선택해 주세요.
                        </div>
                    ) : null}
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
      <span className={strong ? "font-extrabold text-slate-900" : ""}>
        {label}
      </span>
            <span className={strong ? "font-extrabold text-slate-900" : ""}>
        {value}
      </span>
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