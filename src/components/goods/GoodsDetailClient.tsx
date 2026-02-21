// src/components/goods/GoodsDetailClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type GoodsDetailData = {
    id: string;
    title: string;
    price: number;
    badges?: { left?: string; right?: string };
    meta?: { timeLeft?: string; pickup?: string };
    images: { key: string; label?: string }[];
    options: {
        id: string;
        name: string;
        price: number | null; // null이면 기본 상품가와 동일
        soldout?: boolean;
        stockNote?: string;
    }[];
    notices?: { icon?: string; text: string }[];
};

export default function GoodsDetailClient(props: { tenant: string; data: GoodsDetailData }) {
    const { tenant, data } = props;

    const [imgIdx, setImgIdx] = useState(0);

    // 옵션별 수량
    const [qty, setQty] = useState<Record<string, number>>(() =>
        Object.fromEntries(data.options.map((o) => [o.id, 0])),
    );

    const total = useMemo(() => {
        return data.options.reduce((sum, o) => {
            const q = qty[o.id] ?? 0;
            if (!q) return sum;
            const unit = o.price ?? data.price;
            return sum + unit * q;
        }, 0);
    }, [qty, data.price, data.options]);

    const totalCount = useMemo(() => Object.values(qty).reduce((a, b) => a + b, 0), [qty]);

    const canOrder = totalCount > 0;

    const imgLabel = data.images?.[imgIdx]?.label?.trim();

    return (
        <main className="mx-auto max-w-[520px] pb-24">
            {/* ✅ 공통 헤더를 쓰므로, 내부 헤더(목록/주문) 제거 */}
            <div className="px-4 pt-3">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="relative bg-slate-100">
                        <div className="aspect-[4/3]" />

                        {/* 배지 */}
                        <div className="absolute left-3 top-3 flex gap-2">
                            {data.badges?.left ? (
                                <span className="rounded-full bg-[color:var(--brand)] px-2.5 py-1 text-[11px] font-extrabold text-white">
                  {data.badges.left}
                </span>
                            ) : null}
                            {data.badges?.right ? (
                                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-extrabold text-white">
                  {data.badges.right}
                </span>
                            ) : null}
                        </div>

                        {/* ✅ 이미지 라벨: 있을 때만 표시 (DAICLO fallback 제거) */}
                        {imgLabel ? (
                            <div className="absolute bottom-3 left-3">
                <span className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-extrabold text-slate-900">
                  {imgLabel}
                </span>
                            </div>
                        ) : null}

                        {/* 캐러셀 버튼 */}
                        <div className="absolute bottom-3 right-3 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    setImgIdx((v) => (v - 1 + data.images.length) % data.images.length)
                                }
                                className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-sm font-black text-slate-800 shadow-sm"
                                aria-label="이전 이미지"
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                onClick={() => setImgIdx((v) => (v + 1) % data.images.length)}
                                className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-sm font-black text-slate-800 shadow-sm"
                                aria-label="다음 이미지"
                            >
                                ›
                            </button>
                        </div>
                    </div>

                    <div className="px-4 py-4">
                        <div className="text-[15px] font-extrabold text-slate-900">{data.title}</div>

                        <div className="mt-2 flex items-end justify-between gap-3">
                            <div className="text-xl font-extrabold text-slate-900">{data.price.toLocaleString()}원</div>
                            <div className="text-right text-[12px] font-semibold text-slate-500">
                                {data.meta?.timeLeft ? <div>{data.meta.timeLeft}</div> : null}
                                {data.meta?.pickup ? <div className="mt-0.5">{data.meta.pickup}</div> : null}
                            </div>
                        </div>

                        {data.notices?.length ? (
                            <div className="mt-3 space-y-2">
                                {data.notices.map((n, idx) => (
                                    <div
                                        key={idx}
                                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-700"
                                    >
                                        <span className="mr-2">{n.icon ?? "ℹ️"}</span>
                                        {n.text}
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* 옵션/구성 */}
            <div className="px-4">
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="text-[15px] font-extrabold text-slate-900">구성 선택</div>
                        <span className="rounded-full bg-[color:var(--brand-weak)] px-2 py-1 text-[11px] font-extrabold text-[color:var(--brand)]">
              {data.options.length}종
            </span>
                    </div>

                    <div className="mt-3 space-y-3">
                        {data.options.map((o) => {
                            const q = qty[o.id] ?? 0;
                            const disabled = !!o.soldout;
                            const unit = (o.price ?? data.price).toLocaleString();

                            return (
                                <div key={o.id} className="rounded-2xl border border-slate-200 p-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                {o.soldout ? (
                                                    <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-extrabold text-rose-700">
                            🔥 {o.stockNote ?? "품절"}
                          </span>
                                                ) : o.stockNote ? (
                                                    <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-extrabold text-amber-700">
                            🧡 {o.stockNote}
                          </span>
                                                ) : null}
                                            </div>

                                            <div className="mt-2 line-clamp-2 text-[14px] font-extrabold text-slate-900">
                                                {o.name}
                                            </div>
                                            <div className="mt-1 text-[12px] font-semibold text-slate-600">
                                                {unit}원
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                disabled={disabled || q <= 0}
                                                onClick={() =>
                                                    setQty((prev) => ({ ...prev, [o.id]: Math.max(0, q - 1) }))
                                                }
                                                className={[
                                                    "grid h-10 w-10 place-items-center rounded-full border text-lg font-black",
                                                    disabled || q <= 0
                                                        ? "border-slate-200 bg-slate-50 text-slate-300"
                                                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                                                ].join(" ")}
                                                aria-label="수량 감소"
                                            >
                                                –
                                            </button>

                                            <div className="w-7 text-center text-[14px] font-extrabold tabular-nums text-slate-900">
                                                {q}
                                            </div>

                                            <button
                                                type="button"
                                                disabled={disabled}
                                                onClick={() => setQty((prev) => ({ ...prev, [o.id]: q + 1 }))}
                                                className={[
                                                    "grid h-10 w-10 place-items-center rounded-full border text-lg font-black",
                                                    disabled
                                                        ? "border-slate-200 bg-slate-50 text-slate-300"
                                                        : "border-[color:var(--brand)] bg-[color:var(--brand)] text-white hover:opacity-90",
                                                ].join(" ")}
                                                aria-label="수량 증가"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    {q > 0 ? (
                                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-700">
                                            소계: {(q * (o.price ?? data.price)).toLocaleString()}원
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 하단 고정 주문바 */}
            <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur">
                <div className="mx-auto max-w-[520px] px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-[11px] font-semibold text-slate-500">선택 수량</div>
                            <div className="mt-0.5 text-[14px] font-extrabold text-slate-900">{totalCount}개</div>
                        </div>

                        <div className="text-right">
                            <div className="text-[11px] font-semibold text-slate-500">합계</div>
                            <div className="mt-0.5 text-[16px] font-extrabold text-slate-900">
                                {total.toLocaleString()}원
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <Link
                            href={`/${tenant}/goods`}
                            className="rounded-2xl border border-slate-200 bg-white py-3 text-center text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                        >
                            더 보기
                        </Link>

                        <Link
                            href={canOrder ? `/${tenant}/order/new` : "#"}
                            onClick={(e) => {
                                if (!canOrder) e.preventDefault();
                            }}
                            className={[
                                "rounded-2xl py-3 text-center text-sm font-extrabold",
                                canOrder ? "bg-[color:var(--brand)] text-white hover:opacity-90" : "bg-slate-200 text-slate-500",
                            ].join(" ")}
                        >
                            🛒 주문하기
                        </Link>
                    </div>

                    {!canOrder ? (
                        <div className="mt-2 text-center text-[11px] font-semibold text-slate-500">
                            옵션 수량을 1개 이상 선택해 주세요.
                        </div>
                    ) : null}
                </div>
            </div>
        </main>
    );
}