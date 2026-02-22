// src/components/goods/GoodsDetailClient.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartProvider";

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
        price: number | null;
        soldout?: boolean;
        stockNote?: string;
    }[];
    notices?: { icon?: string; text: string }[];
};

type SelectedLine = {
    optionId: string;
    optionName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    soldout: boolean;
};

export default function GoodsDetailClient(props: { tenant: string; data: GoodsDetailData }) {
    const { tenant, data } = props;
    const router = useRouter();
    const cart = useCart() as any;

    const [imgIdx, setImgIdx] = useState(0);

    // 옵션별 수량
    const [qty, setQty] = useState<Record<string, number>>(() =>
        Object.fromEntries(data.options.map((o) => [o.id, 0])),
    );

    const optionById = useMemo(() => new Map(data.options.map((o) => [o.id, o])), [data.options]);

    const selectedLines = useMemo(() => {
        return data.options
            .map((o) => {
                const q = qty[o.id] ?? 0;
                if (!q) return null;
                const unit = o.price ?? data.price;
                return {
                    optionId: o.id,
                    optionName: o.name,
                    unitPrice: unit,
                    quantity: q,
                    lineTotal: unit * q,
                    soldout: !!o.soldout,
                };
            })
            .filter(Boolean) as SelectedLine[];
    }, [qty, data.options, data.price]);

    const subtotal = useMemo(
        () => selectedLines.reduce((sum, l) => sum + l.lineTotal, 0),
        [selectedLines],
    );

    const totalCount = useMemo(
        () => selectedLines.reduce((a, b) => a + b.quantity, 0),
        [selectedLines],
    );

    const canOrder = totalCount > 0;

    // ✅ MVP 배송비(표시/계산만): 추후 정책 API로 교체
    const SHIPPING_FEE = 4000;
    const shipping = canOrder ? SHIPPING_FEE : 0;
    const grandTotal = subtotal + shipping;

    const imgLabel = data.images?.[imgIdx]?.label?.trim();
    const [sheetOpen, setSheetOpen] = useState(false);

    function addLinesToCart() {
        const payloadItems = selectedLines.map((l) => ({
            productId: `${data.id}__${l.optionId}`,
            name: `${data.title} / ${l.optionName}`,
            price: l.unitPrice,
            quantity: l.quantity,
        }));

        if (typeof cart?.addItems === "function") {
            cart.addItems(payloadItems);
            return true;
        }
        if (typeof cart?.addItem === "function") {
            payloadItems.forEach((it) => cart.addItem(it));
            return true;
        }
        if (typeof cart?.add === "function") {
            payloadItems.forEach((it) => cart.add(it));
            return true;
        }

        console.warn("[CartProvider] addItems/addItem/add 메서드를 찾지 못했습니다.");
        return false;
    }

    function goCart() {
        if (!canOrder) return;
        addLinesToCart();
        setSheetOpen(false);
        router.push(`/${tenant}/cart`);
    }

    function goOrder() {
        if (!canOrder) return;
        addLinesToCart();
        setSheetOpen(false);
        router.push(`/${tenant}/order`);
    }

    const adjustQty = (optionId: string, delta: number) => {
        const opt = optionById.get(optionId);
        const isSoldout = !!opt?.soldout;

        // ✅ 품절 옵션은 + 불가 (완전 비활성)
        if (delta > 0 && isSoldout) return;

        setQty((prev) => {
            const cur = prev[optionId] ?? 0;
            const next = Math.max(0, cur + delta);
            return { ...prev, [optionId]: next };
        });
    };

    return (
        <main className="mx-auto max-w-[520px] pb-24">
            {/* 상단 상품 카드 */}
            <div className="px-4 pt-3">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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

                        {/* 이미지 라벨 */}
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
                                onClick={() => setImgIdx((v) => (v - 1 + data.images.length) % data.images.length)}
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

                                            <div className="mt-2 line-clamp-2 text-[14px] font-extrabold text-slate-900">{o.name}</div>
                                            <div className="mt-1 text-[12px] font-semibold text-slate-600">{unit}원</div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                disabled={disabled || q <= 0}
                                                onClick={() => adjustQty(o.id, -1)}
                                                className={[
                                                    "grid h-10 w-10 place-items-center rounded-full border text-lg font-black",
                                                    disabled || q <= 0
                                                        ? "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
                                                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                                                ].join(" ")}
                                                aria-label="수량 감소"
                                            >
                                                –
                                            </button>

                                            <div className="w-7 text-center text-[14px] font-extrabold tabular-nums text-slate-900">{q}</div>

                                            <button
                                                type="button"
                                                disabled={disabled}
                                                onClick={() => adjustQty(o.id, +1)}
                                                className={[
                                                    "grid h-10 w-10 place-items-center rounded-full border text-lg font-black",
                                                    disabled
                                                        ? "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
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

            {/* ✅ 상품 상세 하단 "구매하기" → 시트 오픈 */}
            {!sheetOpen ? (
                <div className="fixed bottom-0 left-0 right-0 z-[50] border-t border-slate-200 bg-white/95 backdrop-blur">
                    <div
                        className="mx-auto max-w-[520px] px-4 py-3"
                        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
                    >
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-200 bg-white text-xl"
                                aria-label="찜"
                                onClick={() => {}}
                            >
                                ♡
                            </button>

                            <button
                                type="button"
                                onClick={() => setSheetOpen(true)}
                                className="h-12 flex-1 rounded-2xl bg-red-500 text-center text-[15px] font-extrabold text-white active:scale-[0.995]"
                            >
                                구매하기
                            </button>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                            <span>선택 {totalCount}개</span>
                            <span>합계 {subtotal.toLocaleString()}원</span>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* ✅ 바텀시트: 상단에 "선택 n개/합계" 고정 + 하단 버튼 2개(간격 좁게) */}
            {sheetOpen ? (
                <>
                    {/* overlay */}
                    <button
                        type="button"
                        aria-label="닫기"
                        className="fixed inset-0 z-[80] bg-black/30"
                        onClick={() => setSheetOpen(false)}
                    />

                    {/* sheet */}
                    <div className="fixed bottom-0 left-0 right-0 z-[81]">
                        <div className="mx-auto max-w-[520px] rounded-t-3xl bg-white shadow-2xl overflow-hidden">
                            {/* 핸들 */}
                            <div className="flex justify-center pt-3">
                                <div className="h-1.5 w-10 rounded-full bg-slate-200" />
                            </div>

                            {/* ✅ 시트 상단 고정 헤더(쿠팡 느낌) */}
                            <div className="sticky top-0 z-10 bg-white px-4 pb-3 pt-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="line-clamp-1 text-[14px] font-extrabold text-slate-900">
                                            {data.title}
                                        </div>
                                        <div className="mt-1 text-[12px] font-semibold text-slate-500">
                                            선택 {totalCount}개 / 합계 {grandTotal.toLocaleString()}원
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setSheetOpen(false)}
                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700"
                                    >
                                        닫기
                                    </button>
                                </div>

                                {/* ✅ 수량 0일 때 안내문(고정영역에 노출) */}
                                {!canOrder ? (
                                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
                                        옵션 수량을 선택해 주세요.
                                    </div>
                                ) : null}
                            </div>

                            <div className="flex max-h-[75vh] flex-col">
                                {/* 본문(스크롤) */}
                                <div className="flex-1 overflow-auto px-4 pb-4">
                                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                        <div className="text-[12px] font-extrabold text-slate-900">선택 옵션</div>

                                        <div className="mt-2 space-y-2">
                                            {selectedLines.length === 0 ? (
                                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] font-semibold text-slate-600">
                                                    옵션 수량을 선택해 주세요.
                                                </div>
                                            ) : (
                                                selectedLines.map((l) => {
                                                    const opt = optionById.get(l.optionId);
                                                    const soldout = !!opt?.soldout;

                                                    return (
                                                        <div key={l.optionId} className="flex items-center justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    {soldout ? (
                                                                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-extrabold text-rose-700">
                                      품절
                                    </span>
                                                                    ) : null}
                                                                    <div className="line-clamp-1 text-[12px] font-semibold text-slate-700">
                                                                        {l.optionName}
                                                                    </div>
                                                                </div>

                                                                <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
                                                                    {l.unitPrice.toLocaleString()}원 x {l.quantity}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => adjustQty(l.optionId, -1)}
                                                                        disabled={l.quantity <= 0}
                                                                        className={[
                                                                            "grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-black shadow-sm",
                                                                            l.quantity <= 0 ? "text-slate-300 cursor-not-allowed" : "text-slate-700",
                                                                        ].join(" ")}
                                                                        aria-label="수량 감소"
                                                                    >
                                                                        –
                                                                    </button>

                                                                    <div className="w-8 text-center text-[13px] font-extrabold tabular-nums text-slate-900">
                                                                        {l.quantity}
                                                                    </div>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => adjustQty(l.optionId, +1)}
                                                                        disabled={soldout}
                                                                        className={[
                                                                            "grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-black shadow-sm",
                                                                            soldout ? "text-slate-300 cursor-not-allowed" : "text-slate-700",
                                                                        ].join(" ")}
                                                                        aria-label="수량 증가"
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>

                                                                <div className="w-[86px] text-right text-[13px] font-extrabold text-slate-900 tabular-nums">
                                                                    {l.lineTotal.toLocaleString()}원
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] font-semibold text-slate-700">
                                        상품금액 {subtotal.toLocaleString()}원 + 배송비 {shipping.toLocaleString()}원
                                    </div>

                                    <div className="mt-3 flex items-center justify-between px-1">
                                        <div className="text-[13px] font-extrabold text-slate-900">총 상품금액</div>
                                        <div className="text-[16px] font-extrabold text-slate-900 tabular-nums">
                                            {grandTotal.toLocaleString()}원
                                        </div>
                                    </div>
                                </div>

                                {/* ✅ footer(고정): 간격 좁게(gap-1) + 버튼 높이 동일 */}
                                <div className="shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur">
                                    <div
                                        className="px-4 py-3"
                                        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
                                    >
                                        <div className="flex gap-1.5">
                                            <button
                                                type="button"
                                                disabled={!canOrder}
                                                onClick={goCart}
                                                className={[
                                                    "h-12 flex-1 rounded-2xl text-sm font-extrabold active:scale-[0.995]",
                                                    canOrder
                                                        ? "bg-rose-50 text-rose-700"
                                                        : "bg-slate-100 text-slate-400 cursor-not-allowed",
                                                ].join(" ")}
                                            >
                                                장바구니
                                            </button>

                                            <button
                                                type="button"
                                                disabled={!canOrder}
                                                onClick={goOrder}
                                                className={[
                                                    "h-12 flex-1 rounded-2xl text-sm font-extrabold text-white active:scale-[0.995]",
                                                    canOrder ? "bg-red-500" : "bg-slate-300 cursor-not-allowed",
                                                ].join(" ")}
                                            >
                                                바로 구매
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* flex-col 끝 */}
                        </div>
                    </div>
                </>
            ) : null}
        </main>
    );
}