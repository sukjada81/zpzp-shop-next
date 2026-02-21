// src/components/cart/CartClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type CartItem = {
    id: string;
    title: string;
    price: number;
    qty: number;
    badges?: { left?: string; right?: string };
    meta?: { timeLeft?: string; pickup?: string };
};

export default function CartClient(props: {
    tenant: string;
    initialItems: CartItem[];
}) {
    const { tenant } = props;
    const [items, setItems] = useState<CartItem[]>(props.initialItems);

    const totalQty = useMemo(
        () => items.reduce((sum, it) => sum + it.qty, 0),
        [items],
    );

    const totalPrice = useMemo(
        () => items.reduce((sum, it) => sum + it.price * it.qty, 0),
        [items],
    );

    const canCheckout = items.length > 0 && totalQty > 0;

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-28 pt-3">
            {/* 상단 */}
            <div className="flex items-center justify-between">
                <Link
                    href={`/${tenant}/home`}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                    ← 홈
                </Link>

                <div className="text-sm font-extrabold text-slate-900">장바구니</div>

                <Link
                    href={`/${tenant}/goods`}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                    상품 →
                </Link>
            </div>

            {/* 요약 카드 */}
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-[12px] font-semibold text-slate-500">
                            선택 수량
                        </div>
                        <div className="mt-0.5 text-[16px] font-extrabold text-slate-900">
                            {totalQty}개
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-[12px] font-semibold text-slate-500">합계</div>
                        <div className="mt-0.5 text-[18px] font-extrabold text-slate-900">
                            {totalPrice.toLocaleString()}원
                        </div>
                    </div>
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-700">
                    픽업/공구 상품은 수령 일정이 있을 수 있어요.
                </div>
            </div>

            {/* 리스트 */}
            <div className="mt-4 space-y-3">
                {items.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                        <div className="text-[15px] font-extrabold text-slate-900">
                            장바구니가 비어 있어요
                        </div>
                        <div className="mt-2 text-[12px] font-semibold text-slate-500">
                            상품을 담고 다시 와주세요.
                        </div>

                        <Link
                            href={`/${tenant}/goods`}
                            className="mt-4 inline-flex items-center justify-center rounded-2xl bg-[color:var(--brand)] px-4 py-3 text-sm font-extrabold text-white hover:opacity-90"
                        >
                            상품 보러가기
                        </Link>
                    </div>
                ) : (
                    items.map((it) => (
                        <div
                            key={it.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                            <div className="flex gap-3">
                                {/* 썸네일 */}
                                <div className="h-[88px] w-[88px] flex-none rounded-2xl bg-slate-100" />

                                <div className="min-w-0 flex-1">
                                    {/* 배지 */}
                                    <div className="flex items-center gap-2">
                                        {it.badges?.left ? (
                                            <span className="rounded-full bg-[color:var(--brand)] px-2.5 py-1 text-[11px] font-extrabold text-white">
                        {it.badges.left}
                      </span>
                                        ) : null}
                                        {it.badges?.right ? (
                                            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-extrabold text-white">
                        {it.badges.right}
                      </span>
                                        ) : null}
                                    </div>

                                    <div className="mt-2 line-clamp-2 text-[14px] font-extrabold text-slate-900">
                                        {it.title}
                                    </div>

                                    <div className="mt-1 flex items-end justify-between">
                                        <div className="text-[14px] font-extrabold text-slate-900">
                                            {(it.price * it.qty).toLocaleString()}원
                                        </div>
                                        <div className="text-right text-[11px] font-semibold text-slate-500">
                                            <div>{it.meta?.timeLeft ?? ""}</div>
                                            <div className="mt-0.5">{it.meta?.pickup ?? ""}</div>
                                        </div>
                                    </div>

                                    {/* 수량 컨트롤 */}
                                    <div className="mt-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setItems((prev) =>
                                                        prev.map((p) =>
                                                            p.id === it.id
                                                                ? { ...p, qty: Math.max(1, p.qty - 1) }
                                                                : p,
                                                        ),
                                                    )
                                                }
                                                className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-lg font-black text-slate-700 hover:bg-slate-50"
                                                aria-label="수량 감소"
                                            >
                                                –
                                            </button>

                                            <div className="w-8 text-center text-[14px] font-extrabold tabular-nums text-slate-900">
                                                {it.qty}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setItems((prev) =>
                                                        prev.map((p) =>
                                                            p.id === it.id ? { ...p, qty: p.qty + 1 } : p,
                                                        ),
                                                    )
                                                }
                                                className="grid h-10 w-10 place-items-center rounded-full border border-[color:var(--brand)] bg-[color:var(--brand)] text-lg font-black text-white hover:opacity-90"
                                                aria-label="수량 증가"
                                            >
                                                +
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setItems((prev) => prev.filter((p) => p.id !== it.id))
                                            }
                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-extrabold text-slate-600 hover:bg-slate-50"
                                        >
                                            삭제
                                        </button>
                                    </div>

                                    {/* 액션 */}
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <Link
                                            href={`/${tenant}/goods/${it.id}`}
                                            className="rounded-2xl border border-slate-200 bg-white py-3 text-center text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                                        >
                                            상세 보기
                                        </Link>
                                        <Link
                                            href={`/${tenant}/order/new`}
                                            className="rounded-2xl bg-[color:var(--brand)] py-3 text-center text-sm font-extrabold text-white hover:opacity-90"
                                        >
                                            바로 주문
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* 하단 고정 바 */}
            <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur">
                <div className="mx-auto max-w-[520px] px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-[11px] font-semibold text-slate-500">
                                합계
                            </div>
                            <div className="mt-0.5 text-[16px] font-extrabold text-slate-900">
                                {totalPrice.toLocaleString()}원
                            </div>
                        </div>

                        <Link
                            href={canCheckout ? `/${tenant}/order/new` : "#"}
                            onClick={(e) => {
                                if (!canCheckout) e.preventDefault();
                            }}
                            className={[
                                "rounded-2xl px-5 py-3 text-center text-sm font-extrabold",
                                canCheckout
                                    ? "bg-[color:var(--brand)] text-white hover:opacity-90"
                                    : "bg-slate-200 text-slate-500",
                            ].join(" ")}
                        >
                            주문하기
                        </Link>
                    </div>

                    {!canCheckout ? (
                        <div className="mt-2 text-center text-[11px] font-semibold text-slate-500">
                            장바구니가 비어 있어요.
                        </div>
                    ) : null}
                </div>
            </div>
        </main>
    );
}