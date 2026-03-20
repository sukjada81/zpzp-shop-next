// src/components/goods/GoodsDetailClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartProvider";
import { endpoints } from "@/lib/api/endpoints";
import { saveGuestOrderRef } from "@/lib/orders/guestOrderRefs";
import { readQuickOrderProfile } from "@/lib/profile/quickOrderProfile";

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
        rawOptionId?: number | string;
    }[];
    notices?: { icon?: string; text: string }[];
};

type SelectedLine = {
    optionId: string;
    rawOptionId?: number | string;
    optionName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    soldout: boolean;
};

type CreateOrderResponse = {
    ok: boolean;
    orderNum?: string;
    status?: number;
    statusLabel?: string;
    message?: string;
    error?: string;
    detail?: string;
};

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

function toOptionalNumberId(value?: string | number) {
    if (value == null) return undefined;
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : undefined;
    }
    const text = value.trim();
    if (!text) return undefined;
    const n = Number(text);
    return Number.isFinite(n) ? n : undefined;
}

function toStableIdText(value?: string | number) {
    if (value == null) return "";
    return String(value);
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

function buildLoginHref(tenant: string, returnTo: string) {
    return `/${tenant}/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export default function GoodsDetailClient(props: { tenant: string; data: GoodsDetailData }) {
    const { tenant, data } = props;
    const router = useRouter();
    const pathname = usePathname();
    const cart = useCart();

    const safeImages = useMemo(() => {
        if (Array.isArray(data.images) && data.images.length > 0) return data.images;
        return [{ key: "", label: "이미지 없음" }];
    }, [data.images]);

    const [imgIdx, setImgIdx] = useState(0);
    const canCarousel = safeImages.length > 1;

    const [qty, setQty] = useState<Record<string, number>>(
        () => Object.fromEntries(data.options.map((o) => [o.id, 0]))
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
                    rawOptionId: o.rawOptionId,
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
        [selectedLines]
    );

    const totalCount = useMemo(
        () => selectedLines.reduce((sum, l) => sum + l.quantity, 0),
        [selectedLines]
    );

    const [sheetOpen, setSheetOpen] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("장바구니에 넣었어요.");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!toastOpen) return;
        const t = window.setTimeout(() => setToastOpen(false), 1600);
        return () => window.clearTimeout(t);
    }, [toastOpen]);

    const mainImage = safeImages[imgIdx];
    const mainImg = toAbsoluteImageUrl(mainImage?.key || "");
    const imgLabel = mainImage?.label ?? "";
    const pickupPeriodText = buildPickupPeriodText(
        data.meta?.pickupStartAt,
        data.meta?.pickupEndAt
    );

    const descRaw = String(data.description ?? "").trim();
    const descIsHtml = looksLikeHtml(descRaw);
    const descHtml = descIsHtml ? absolutizeHtmlImageSrc(sanitizeHtml(descRaw)) : "";

    function redirectToLogin() {
        const returnTo = pathname || `/${tenant}/goods/${data.id}`;
        alert("로그인 해야 주문이 가능합니다.");
        router.push(buildLoginHref(tenant, returnTo));
    }

    function adjustQty(optionId: string, delta: number) {
        const opt = optionById.get(optionId);
        if (delta > 0 && opt?.soldout) return;

        setQty((prev) => {
            const cur = prev[optionId] ?? 0;
            const next = Math.max(0, cur + delta);
            return { ...prev, [optionId]: next };
        });
    }

    function handleAddCart() {
        if (!selectedLines.length) {
            alert("옵션을 먼저 선택해주세요.");
            return;
        }

        cart.addItems(
            selectedLines.map((line) => ({
                productId: data.id,
                name: data.title,
                price: line.unitPrice,
                quantity: line.quantity,
                optionId: toOptionalNumberId(line.rawOptionId) ?? line.optionId,
                optionName: line.optionName,
                thumbnailUrl: mainImg || undefined,
                tenant,
            }))
        );

        setToastMessage("장바구니에 넣었어요.");
        setToastOpen(true);
    }

    async function handleQuickOrder() {
        if (!selectedLines.length) {
            alert("옵션을 먼저 선택해주세요.");
            return;
        }

        const profile = readQuickOrderProfile(tenant);
        if (!profile) {
            redirectToLogin();
            return;
        }

        try {
            setSubmitting(true);

            const res = await fetch(endpoints.createOrder(tenant), {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                credentials: "include",
                cache: "no-store",
                body: JSON.stringify({
                    buyerName: profile.nickname,
                    buyerPhone: profile.phone || "",
                    receiverName: profile.nickname,
                    receiverPhone: profile.phone || "",
                    pickupAt: null,
                    message: "",
                    memo: "상품상세 빠른주문",
                    direct: 1,
                    items: selectedLines.map((line) => ({
                        productId: Number(data.id),
                        optionId: toOptionalNumberId(line.rawOptionId),
                        optionName: line.optionName,
                        qty: Number(line.quantity),
                    })),
                }),
            });

            const json = (await res.json().catch(() => ({}))) as CreateOrderResponse;

            if (res.status === 401) {
                redirectToLogin();
                return;
            }

            if (!res.ok || json?.ok === false || !json?.orderNum) {
                throw new Error(
                    json?.message ||
                    json?.error ||
                    json?.detail ||
                    `주문 생성 실패 (HTTP ${res.status})`
                );
            }

            const orderNum = json.orderNum;

            saveGuestOrderRef({
                tenant,
                orderNum,
                phone: profile.phone || "",
                buyerName: profile.nickname,
                createdAt: new Date().toISOString(),
            });

            setSheetOpen(false);
            setToastMessage("주문이 완료되었어요.");
            setToastOpen(true);
            setQty((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((key) => {
                    next[key] = 0;
                });
                return next;
            });

            window.setTimeout(() => {
                router.replace(`/${tenant}/orders?highlight=${encodeURIComponent(orderNum)}`);
            }, 900);
        } catch (e: any) {
            alert(e?.message || "주문 처리 중 오류가 발생했습니다.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
            <main className="goods-detail-page mx-auto w-full max-w-[1200px] px-0 pb-24 md:px-6 lg:px-8">
                <div className="md:grid md:grid-cols-[minmax(0,1fr)_420px] md:items-start md:gap-8 lg:grid-cols-[minmax(0,1fr)_460px]">
                    <section className="overflow-hidden bg-white md:rounded-[28px] md:border md:border-[color:var(--border)] md:shadow-sm">
                        <div className="relative bg-slate-100">
                            <div className="aspect-[3/4]" />
                            {mainImg ? (
                                <img
                                    src={mainImg}
                                    alt={data.title}
                                    className="absolute inset-0 h-full w-full object-cover"
                                />
                            ) : null}

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
                                        onClick={() =>
                                            setImgIdx((v) => (v - 1 + safeImages.length) % safeImages.length)
                                        }
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
                            <div className="flex gap-2 overflow-x-auto px-4 py-4 md:px-5">
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
                                            <div className="h-16 w-16 bg-[color:var(--brand-soft)] md:h-20 md:w-20">
                                                {thumb ? (
                                                    <img
                                                        src={thumb}
                                                        alt={`${data.title}-${idx + 1}`}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-full w-full bg-gradient-to-br from-white to-[color:var(--brand-soft)]" />
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}
                    </section>

                    <section className="px-4 pb-6 pt-4 md:sticky md:top-24 md:px-0">
                        <div className="rounded-[24px] border border-[color:var(--border)] bg-white p-4 shadow-sm md:p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-[20px] font-extrabold leading-snug text-slate-900 md:text-[26px]">
                                        {data.title}
                                    </div>
                                </div>

                                <div className="shrink-0 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <span className="text-[14px] font-extrabold text-rose-600">₩</span>
                                        <span className="tabular-nums text-[28px] font-extrabold text-slate-900 md:text-[34px]">
                                            {data.price.toLocaleString()}
                                        </span>
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

                            <div className="mt-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                                <div className="text-[13px] font-extrabold text-slate-900">옵션 선택</div>

                                <div className="mt-3 space-y-3">
                                    {data.options.map((opt) => {
                                        const unitPrice = opt.price ?? data.price;
                                        const count = qty[opt.id] ?? 0;

                                        return (
                                            <div
                                                key={opt.id}
                                                className="rounded-2xl border border-[color:var(--border)] bg-white p-3"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="text-[14px] font-bold text-slate-900">
                                                            {opt.name}
                                                        </div>
                                                        <div className="mt-1 text-[13px] font-semibold text-slate-500">
                                                            {unitPrice.toLocaleString()}원
                                                        </div>
                                                        {opt.stockNote ? (
                                                            <div className="mt-1 text-[12px] text-slate-400">
                                                                {opt.stockNote}
                                                            </div>
                                                        ) : null}
                                                        {opt.soldout ? (
                                                            <div className="mt-1 text-[12px] font-bold text-rose-600">
                                                                품절
                                                            </div>
                                                        ) : null}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => adjustQty(opt.id, -1)}
                                                            className="grid h-8 w-8 place-items-center rounded-full border border-[color:var(--border)] bg-white text-base font-black"
                                                        >
                                                            -
                                                        </button>
                                                        <div className="min-w-[20px] text-center text-sm font-extrabold">
                                                            {count}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => adjustQty(opt.id, 1)}
                                                            disabled={!!opt.soldout}
                                                            className="grid h-8 w-8 place-items-center rounded-full border border-[color:var(--border)] bg-white text-base font-black disabled:opacity-40"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
                                    <div className="flex items-center justify-between text-[13px] font-semibold text-slate-600">
                                        <span>선택 수량</span>
                                        <span>{totalCount}개</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-[15px] font-extrabold text-slate-900">
                                        <span>총 상품금액</span>
                                        <span>{subtotal.toLocaleString()}원</span>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={handleAddCart}
                                        className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm font-extrabold text-[color:var(--brand)]"
                                    >
                                        장바구니
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSheetOpen(true)}
                                        className="rounded-2xl bg-[color:var(--accent)] px-4 py-3 text-sm font-extrabold text-white"
                                    >
                                        바로 구매
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {descRaw ? (
                    <section className="px-4 md:px-0">
                        <div className="mt-4 rounded-[24px] border border-[color:var(--border)] bg-white p-4 shadow-sm md:mt-8 md:p-6">
                            <div className="text-[16px] font-extrabold text-slate-900 md:text-[20px]">
                                상품 상세정보
                            </div>

                            {descIsHtml ? (
                                <div
                                    className="dad-detail-html mt-4 overflow-hidden break-words text-[14px] leading-[1.7] text-slate-700"
                                    dangerouslySetInnerHTML={{ __html: descHtml }}
                                />
                            ) : (
                                <div className="mt-4 whitespace-pre-wrap break-words text-[14px] leading-[1.7] text-slate-700">
                                    {descRaw}
                                </div>
                            )}
                        </div>
                    </section>
                ) : null}
            </main>

            {sheetOpen ? (
                <div className="fixed inset-0 z-[90] bg-black/45 px-4 py-6 md:flex md:items-center md:justify-center">
                    <div className="mx-auto mt-12 w-full max-w-[520px] rounded-[28px] bg-white p-5 shadow-2xl md:mt-0">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-[18px] font-extrabold text-slate-900">바로 구매 확인</div>
                            <button
                                type="button"
                                onClick={() => setSheetOpen(false)}
                                className="grid h-9 w-9 place-items-center rounded-full border border-[color:var(--border)]"
                            >
                                ×
                            </button>
                        </div>

                        <div className="mt-4 space-y-2">
                            {selectedLines.map((line) => (
                                <div
                                    key={`${line.optionId}:${toStableIdText(line.rawOptionId)}`}
                                    className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate font-bold text-slate-900">{line.optionName}</div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            {line.unitPrice.toLocaleString()}원 × {line.quantity}
                                        </div>
                                    </div>
                                    <div className="shrink-0 font-extrabold text-slate-900">
                                        {line.lineTotal.toLocaleString()}원
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3">
                            <div className="flex items-center justify-between text-sm font-extrabold text-slate-900">
                                <span>총 상품금액</span>
                                <span>{subtotal.toLocaleString()}원</span>
                            </div>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setSheetOpen(false)}
                                className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm font-extrabold text-slate-700"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleQuickOrder}
                                disabled={submitting}
                                className="rounded-2xl bg-[color:var(--accent)] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60"
                            >
                                {submitting ? "처리중..." : "주문하기"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <SuccessToast
                open={toastOpen}
                message={toastMessage}
                onClose={() => setToastOpen(false)}
            />
        </>
    );
}