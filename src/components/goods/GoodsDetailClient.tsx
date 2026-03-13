// src/components/goods/GoodsDetailClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartProvider";
import { endpoints } from "@/lib/api/endpoints";

export type GoodsDetailData = {
    id: string;
    title: string;
    price: number;
    description?: string | null;
    badges?: { left?: string; right?: string };
    meta?: {
        timeLeft?: string;
        pickup?: string;
        pickupStartAt?: string | null;
        pickupEndAt?: string | null;
        pickupNote?: string | null;
    };
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

type QuickOrderProfile = {
    nickname: string;
    phone: string;
};

type CreateOrderResponse = {
    ok: boolean;
    orderNum?: string;
    status?: number;
    statusLabel?: string;
    message?: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(" ");
}

function looksLikeHtml(s?: string | null) {
    const v = String(s ?? "").trim();
    if (!v) return false;
    return /<\/?[a-z][\s\S]*>/i.test(v);
}

function sanitizeHtml(input: string) {
    let html = input;
    html = html.replace(/<\s*(script|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
    html = html.replace(/<\s*(script|iframe|object|embed)[^>]*\/\s*>/gi, "");
    html = html.replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
    return html;
}

function absolutizeHtmlImageSrc(html: string) {
    const base = (process.env.NEXT_PUBLIC_ASSET_ORIGIN || "").replace(/\/$/, "");
    if (!base) return html;

    const re1 = /\bsrc\s*=\s*(["'])(image\/[^"']+)\1/gi;
    const re2 = /\bsrc\s*=\s*(["'])(\/image\/[^"']+)\1/gi;

    let out = html;
    out = out.replace(re1, (_m, q, p) => `src=${q}${base}/${p}${q}`);
    out = out.replace(re2, (_m, q, p) => `src=${q}${base}${p}${q}`);
    return out;
}

function toAbsoluteImageUrl(input: string) {
    const k = String(input ?? "").trim();
    if (!k) return "";
    if (/^https?:\/\//i.test(k)) return k;

    const base = (process.env.NEXT_PUBLIC_ASSET_ORIGIN || "").replace(/\/$/, "");
    return base ? `${base}${k.startsWith("/") ? "" : "/"}${k}` : k.startsWith("/") ? k : `/${k}`;
}

function onlyDigits(v: string) {
    return String(v ?? "").replace(/[^\d]/g, "");
}

function readQuickOrderProfile(tenant: string): QuickOrderProfile | null {
    try {
        const raw = window.localStorage.getItem(`profile:${tenant || "default"}`);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as { nickname?: string; phone?: string };
        const nickname = String(parsed?.nickname ?? "").trim();
        const phone = onlyDigits(String(parsed?.phone ?? ""));

        if (!nickname || phone.length < 10) return null;

        return { nickname, phone };
    } catch {
        return null;
    }
}

function formatDateTime(value?: string | null) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";

    return new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(d);
}

function buildPickupPeriodText(start?: string | null, end?: string | null) {
    const s = formatDateTime(start);
    const e = formatDateTime(end);

    if (s && e) return `${s} ~ ${e}`;
    if (s) return `${s}부터`;
    if (e) return `${e}까지`;
    return "";
}

function SuccessToast({
                          open,
                          message,
                          onClose,
                      }: {
    open: boolean;
    message: string;
    onClose: () => void;
}) {
    return (
        <div
            className={[
                "pointer-events-none fixed inset-x-0 bottom-24 z-[95] flex justify-center px-4 transition-all duration-300",
                open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
            ].join(" ")}
        >
            <div className="pointer-events-auto w-full max-w-[520px]">
                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/95 px-5 py-4 shadow-lg backdrop-blur">
                    <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-green-500 text-xl font-black text-white">
                            ✓
                        </div>

                        <div className="min-w-0 flex-1 text-[15px] font-extrabold text-emerald-900">
                            {message}
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="grid h-8 w-8 place-items-center rounded-full text-xl font-bold text-emerald-700"
                            aria-label="닫기"
                        >
                            ×
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function GoodsDetailClient(props: { tenant: string; data: GoodsDetailData }) {
    const { tenant, data } = props;
    const router = useRouter();
    const cart = useCart() as any;

    const safeImages = useMemo(() => {
        if (Array.isArray(data.images) && data.images.length > 0) return data.images;
        return [{ key: "", label: "이미지 없음" }];
    }, [data.images]);

    const [imgIdx, setImgIdx] = useState(0);
    const canCarousel = safeImages.length > 1;

    const [qty, setQty] = useState<Record<string, number>>(() =>
        Object.fromEntries(data.options.map((o) => [o.id, 0]))
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

    const subtotal = useMemo(() => selectedLines.reduce((sum, l) => sum + l.lineTotal, 0), [selectedLines]);
    const totalCount = useMemo(() => selectedLines.reduce((a, b) => a + b.quantity, 0), [selectedLines]);
    const canOrder = totalCount > 0;

    const SHIPPING_FEE = 4000;
    const shipping = canOrder ? SHIPPING_FEE : 0;
    const grandTotal = subtotal + shipping;

    const imgLabel = safeImages?.[imgIdx]?.label?.trim();
    const [sheetOpen, setSheetOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);

    useEffect(() => {
        if (!toastOpen) return;

        const timer = window.setTimeout(() => {
            setToastOpen(false);
        }, 1800);

        return () => window.clearTimeout(timer);
    }, [toastOpen]);

    const mainImg = useMemo(() => {
        return toAbsoluteImageUrl(safeImages?.[imgIdx]?.key ?? "");
    }, [safeImages, imgIdx]);

    const primaryThumb = useMemo(() => {
        return toAbsoluteImageUrl(safeImages?.[0]?.key ?? "");
    }, [safeImages]);

    const descRaw = String(data.description ?? "").trim();
    const descIsHtml = looksLikeHtml(descRaw);

    const descHtml = useMemo(() => {
        if (!descIsHtml) return "";
        const safe = sanitizeHtml(descRaw);
        return absolutizeHtmlImageSrc(safe);
    }, [descIsHtml, descRaw]);

    const pickupPeriodText = useMemo(() => {
        return buildPickupPeriodText(data.meta?.pickupStartAt, data.meta?.pickupEndAt);
    }, [data.meta?.pickupStartAt, data.meta?.pickupEndAt]);

    function addLinesToCart() {
        const payloadItems = selectedLines.map((l) => ({
            productId: `${data.id}__${l.optionId}`,
            baseProductId: String(data.id),
            name: `${data.title} / ${l.optionName}`,
            price: l.unitPrice,
            quantity: l.quantity,
            thumbnailUrl: primaryThumb || "",
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

    async function goOrder() {
        if (!canOrder || submitting) return;

        const profile = readQuickOrderProfile(tenant);
        if (!profile) {
            alert("빠른 주문을 하려면 설정에서 닉네임/전화번호를 먼저 저장해 주세요.");
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
                    buyerName: profile.nickname,
                    buyerPhone: profile.phone,
                    receiverName: profile.nickname,
                    receiverPhone: profile.phone,
                    pickupAt: null,
                    message: "",
                    memo: "상품상세 빠른주문",
                    direct: 1,
                    items: selectedLines.map((line) => ({
                        productId: Number(data.id),
                        optionId: 0,
                        optionName: line.optionName,
                        qty: Number(line.quantity),
                    })),
                }),
            });

            const json = (await res.json().catch(() => ({}))) as CreateOrderResponse;

            if (!res.ok || json?.ok === false || !json?.orderNum) {
                throw new Error(json?.message || `주문 생성 실패 (HTTP ${res.status})`);
            }

            setSheetOpen(false);
            setToastOpen(true);
            setQty((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((key) => {
                    next[key] = 0;
                });
                return next;
            });

            window.setTimeout(() => {
                router.replace(`/${tenant}/home`);
            }, 900);
        } catch (e: any) {
            alert(e?.message || "주문 처리 중 오류가 발생했습니다.");
        } finally {
            setSubmitting(false);
        }
    }

    const adjustQty = (optionId: string, delta: number) => {
        const opt = optionById.get(optionId);
        const isSoldout = !!opt?.soldout;
        if (delta > 0 && isSoldout) return;

        setQty((prev) => {
            const cur = prev[optionId] ?? 0;
            const next = Math.max(0, cur + delta);
            return { ...prev, [optionId]: next };
        });
    };

    return (
        <>
            <main className="mx-auto max-w-[520px] pb-24">
                <section className="bg-white">
                    <div className="relative bg-slate-100">
                        {mainImg ? (
                            <img src={mainImg} alt={data.title} className="h-auto w-full object-contain" />
                        ) : (
                            <div className="aspect-[4/3]" />
                        )}

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

                        {imgLabel ? (
                            <div className="absolute bottom-3 left-3">
                                <span className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-extrabold text-slate-900">
                                    {imgLabel}
                                </span>
                            </div>
                        ) : null}

                        {canCarousel ? (
                            <div className="absolute bottom-3 right-3 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setImgIdx((v) => (v - 1 + safeImages.length) % safeImages.length)}
                                    className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-sm font-black text-slate-800 shadow-sm"
                                    aria-label="이전 이미지"
                                >
                                    ‹
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setImgIdx((v) => (v + 1) % safeImages.length)}
                                    className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-sm font-black text-slate-800 shadow-sm"
                                    aria-label="다음 이미지"
                                >
                                    ›
                                </button>
                            </div>
                        ) : null}
                    </div>

                    {safeImages.length > 1 ? (
                        <div className="flex gap-2 overflow-x-auto px-4 pt-3">
                            {safeImages.map((img, idx) => {
                                const thumb = toAbsoluteImageUrl(img.key);
                                const active = idx === imgIdx;

                                return (
                                    <button
                                        key={`${img.key}_${idx}`}
                                        type="button"
                                        onClick={() => setImgIdx(idx)}
                                        className="shrink-0 overflow-hidden rounded-xl border"
                                        style={{
                                            borderColor: active ? "var(--brand)" : "var(--border)",
                                            boxShadow: active ? "0 0 0 2px rgba(23,59,69,0.08)" : "none",
                                        }}
                                    >
                                        <div className="h-16 w-16 bg-[color:var(--brand-soft)]">
                                            {thumb ? (
                                                <img src={thumb} alt={`${data.title}-${idx + 1}`} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="h-full w-full bg-gradient-to-br from-white to-[color:var(--brand-soft)]" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}

                    <div className="px-4 pt-4 pb-6">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-[20px] font-extrabold leading-snug text-slate-900">{data.title}</div>
                            </div>

                            <div className="shrink-0 text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <span className="text-[14px] font-extrabold text-rose-600">₩</span>
                                    <span className="text-[28px] font-extrabold text-slate-900 tabular-nums">{data.price.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            {data.meta?.timeLeft ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[12px] font-extrabold text-rose-700">
                                    ⏰ {data.meta.timeLeft}
                                </span>
                            ) : null}
                            {data.meta?.pickup ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-extrabold text-slate-700">
                                    🚚 {data.meta.pickup}
                                </span>
                            ) : null}
                        </div>

                        {pickupPeriodText || data.meta?.pickupNote ? (
                            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-[13px] font-extrabold text-slate-900">픽업 안내</div>

                                {pickupPeriodText ? (
                                    <div className="mt-2 text-[13px] font-semibold text-slate-700">
                                        픽업 가능 기간: {pickupPeriodText}
                                    </div>
                                ) : null}

                                {data.meta?.pickupNote ? (
                                    <div className="mt-2 whitespace-pre-wrap break-words text-[13px] font-medium leading-relaxed text-slate-600">
                                        {data.meta.pickupNote}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="mt-5 text-center text-[12px] font-semibold text-slate-400">이미지 클릭시 상세보기 가능합니다.</div>

                        {descRaw ? (
                            descIsHtml ? (
                                <div
                                    className="mt-5 prose prose-sm max-w-none prose-img:max-w-full prose-img:h-auto"
                                    dangerouslySetInnerHTML={{ __html: descHtml }}
                                />
                            ) : (
                                <div className="mt-5 whitespace-pre-wrap break-words text-[14px] font-semibold leading-relaxed text-slate-800">
                                    {descRaw}
                                </div>
                            )
                        ) : null}

                        {data.notices?.length ? (
                            <div className="mt-5 space-y-2">
                                {data.notices.map((n, idx) => (
                                    <div
                                        key={idx}
                                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700"
                                    >
                                        <span className="mr-2">{n.icon ?? "ℹ️"}</span>
                                        {n.text}
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </section>

                <section className="px-4 pt-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
                                const stockText = o.stockNote?.trim() || "🔥 5개 남았습니다!";

                                return (
                                    <div key={o.id} className="rounded-2xl border border-slate-200 p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                            <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-extrabold text-rose-700">
                                {stockText}
                            </span>
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
                                                    onClick={() => adjustQty(o.id, -1)}
                                                    className={cn(
                                                        "grid h-10 w-10 place-items-center rounded-full border text-lg font-black",
                                                        disabled || q <= 0
                                                            ? "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
                                                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                                    )}
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
                                                    onClick={() => adjustQty(o.id, +1)}
                                                    className={cn(
                                                        "grid h-10 w-10 place-items-center rounded-full border text-lg font-black",
                                                        disabled
                                                            ? "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
                                                            : "border-[color:var(--brand)] bg-[color:var(--brand)] text-white hover:opacity-90"
                                                    )}
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
                </section>

                {!sheetOpen ? (
                    <div className="fixed bottom-0 left-0 right-0 z-[50] border-t border-slate-200 bg-white/95 backdrop-blur">
                        <div className="mx-auto max-w-[520px] px-4 py-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
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

                {sheetOpen ? (
                    <>
                        <button type="button" aria-label="닫기" className="fixed inset-0 z-[80] bg-black/30" onClick={() => setSheetOpen(false)} />

                        <div className="fixed bottom-0 left-0 right-0 z-[81]">
                            <div className="mx-auto max-w-[520px] overflow-hidden rounded-t-3xl bg-white shadow-2xl">
                                <div className="flex justify-center pt-3">
                                    <div className="h-1.5 w-10 rounded-full bg-slate-200" />
                                </div>

                                <div className="sticky top-0 z-10 bg-white px-4 pb-3 pt-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="line-clamp-1 text-[14px] font-extrabold text-slate-900">{data.title}</div>
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

                                    {!canOrder ? (
                                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
                                            옵션 수량을 선택해 주세요.
                                        </div>
                                    ) : null}
                                </div>

                                <div className="flex max-h-[75vh] flex-col">
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
                                                                        <div className="line-clamp-1 text-[12px] font-semibold text-slate-700">{l.optionName}</div>
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
                                                                            className={cn(
                                                                                "grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-black shadow-sm",
                                                                                l.quantity <= 0 ? "text-slate-300 cursor-not-allowed" : "text-slate-700"
                                                                            )}
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
                                                                            className={cn(
                                                                                "grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-black shadow-sm",
                                                                                soldout ? "text-slate-300 cursor-not-allowed" : "text-slate-700"
                                                                            )}
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
                                            <div className="text-[16px] font-extrabold text-slate-900 tabular-nums">{grandTotal.toLocaleString()}원</div>
                                        </div>
                                    </div>

                                    <div className="shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur">
                                        <div className="px-4 py-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}>
                                            <div className="flex gap-1.5">
                                                <button
                                                    type="button"
                                                    disabled={!canOrder || submitting}
                                                    onClick={goCart}
                                                    className={cn(
                                                        "h-12 flex-1 rounded-2xl text-sm font-extrabold active:scale-[0.995]",
                                                        canOrder && !submitting
                                                            ? "bg-rose-50 text-rose-700"
                                                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                                    )}
                                                >
                                                    장바구니
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={!canOrder || submitting}
                                                    onClick={goOrder}
                                                    className={cn(
                                                        "h-12 flex-1 rounded-2xl text-sm font-extrabold text-white active:scale-[0.995]",
                                                        canOrder && !submitting ? "bg-red-500" : "bg-slate-300 cursor-not-allowed"
                                                    )}
                                                >
                                                    {submitting ? "주문 처리 중..." : "바로 구매"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : null}
            </main>

            <SuccessToast
                open={toastOpen}
                message="주문이 완료되었어요"
                onClose={() => setToastOpen(false)}
            />
        </>
    );
}