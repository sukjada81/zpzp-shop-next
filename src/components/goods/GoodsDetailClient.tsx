// src/components/goods/GoodsDetailClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingBag, ShoppingCart, Clock3, Truck, Info } from "lucide-react";
import { useCart } from "@/lib/cart/CartProvider";
import BottomToast, { BottomToastTone } from "@/components/ui/BottomToast";
import { endpoints } from "@/lib/api/endpoints";
import { saveGuestOrderRef } from "@/lib/orders/guestOrderRefs";
import {
    isQuickOrderProfileComplete,
    readQuickOrderProfile,
} from "@/lib/profile/quickOrderProfile";

type GoodsOption = {
    id: string;
    name: string;
    price: number | null;
    addPrice?: number;
    qty?: number;
    qtyType?: number;
    soldout?: boolean;
    stockNote?: string;
    rawOptionId?: number | string;
    code?: string;
};

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
    options: GoodsOption[];
    notices?: { icon?: string; text: string }[];
};

type SelectedLine = {
    optionId: string;
    rawOptionId?: number | string;
    optionName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    qty?: number;
    qtyType?: number;
    soldout?: boolean;
    stockNote?: string;
    code?: string;
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

function toAbsoluteImageUrl(input?: string) {
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

function formatAddPrice(addPrice?: number) {
    const value = Number(addPrice ?? 0);
    if (!value) return "";
    return value > 0 ? `+${value.toLocaleString()}원` : `${value.toLocaleString()}원`;
}

function getMaxSelectableQty(option?: GoodsOption) {
    if (!option) return Number.POSITIVE_INFINITY;
    if (Number(option.qtyType ?? 1) === 1) return Number.POSITIVE_INFINITY;
    const qty = Number(option.qty ?? 0);
    return qty > 0 ? qty : 0;
}

function buildLoginHref(tenant: string, returnTo: string) {
    return `/${tenant}/login?returnTo=${encodeURIComponent(returnTo)}`;
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

function QtyControl({
                        value,
                        onMinus,
                        onPlus,
                        disabled,
                    }: {
    value: number;
    onMinus: () => void;
    onPlus: () => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex items-center gap-2">
            <button
                disabled={disabled || value <= 0}
                onClick={onMinus}
                type="button"
                aria-label="decrease"
                className="flex h-10 w-10 items-center justify-center rounded-full border text-lg font-medium transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                    borderColor: "var(--border)",
                    background: "#fff",
                    color: "var(--muted)",
                }}
            >
                −
            </button>

            <div className="min-w-10 text-center text-base font-semibold text-[color:var(--fg)]">
                {value}
            </div>

            <button
                onClick={onPlus}
                disabled={disabled}
                type="button"
                aria-label="increase"
                className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-medium text-white transition-all active:scale-95 disabled:opacity-40"
                style={{
                    background: "var(--accent)",
                    boxShadow: "0 6px 14px color-mix(in srgb, var(--accent) 28%, transparent)",
                }}
            >
                +
            </button>
        </div>
    );
}

function MetaBadge({
                       icon,
                       text,
                       tone = "default",
                   }: {
    icon: React.ReactNode;
    text: string;
    tone?: "danger" | "info" | "default";
}) {
    const toneClass =
        tone === "danger"
            ? "border-rose-200 bg-rose-50 text-rose-500"
            : tone === "info"
                ? "border-[color:var(--border)] bg-white text-[color:var(--brand)]"
                : "border-[color:var(--border)] bg-white text-[color:var(--muted)]";

    return (
        <span
            className={[
                "inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold",
                toneClass,
            ].join(" ")}
        >
            {icon}
            <span>{text}</span>
        </span>
    );
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
    const [qty, setQty] = useState<Record<string, number>>(
        () => Object.fromEntries(data.options.map((o) => [o.id, 0]))
    );
    const [submitting, setSubmitting] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("주문이 완료되었어요.");
    const [toastTone, setToastTone] = useState<BottomToastTone>("success");

    const optionById = useMemo(() => {
        return new Map(data.options.map((o) => [o.id, o]));
    }, [data.options]);

    const selectedLines = useMemo(() => {
        return data.options.reduce<SelectedLine[]>((acc, o) => {
            const q = qty[o.id] ?? 0;
            if (!q) return acc;

            const unit = o.price ?? data.price;

            acc.push({
                optionId: o.id,
                rawOptionId: o.rawOptionId,
                optionName: o.name,
                unitPrice: unit,
                quantity: q,
                lineTotal: unit * q,
                qty: o.qty,
                qtyType: o.qtyType,
                soldout: o.soldout,
                stockNote: o.stockNote,
                code: o.code,
            });

            return acc;
        }, []);
    }, [qty, data.options, data.price]);

    const totalQty = useMemo(() => {
        return selectedLines.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
    }, [selectedLines]);

    const totalPrice = useMemo(() => {
        return selectedLines.reduce((sum, line) => sum + Number(line.lineTotal ?? 0), 0);
    }, [selectedLines]);

    const isActive = totalQty > 0;

    useEffect(() => {
        if (!toastOpen) return;
        const timer = window.setTimeout(() => setToastOpen(false), 1800);
        return () => window.clearTimeout(timer);
    }, [toastOpen]);

    useEffect(() => {
        if (imgIdx > safeImages.length - 1) {
            setImgIdx(0);
        }
    }, [imgIdx, safeImages.length]);

    const descRaw = String(data.description ?? "").trim();
    const descIsHtml = looksLikeHtml(descRaw);
    const descHtml = descIsHtml ? absolutizeHtmlImageSrc(sanitizeHtml(descRaw)) : "";

    const pickupPeriodText = buildPickupPeriodText(
        data.meta?.pickupStartAt,
        data.meta?.pickupEndAt
    );

    const mainImage = safeImages[imgIdx];
    const mainImageUrl = toAbsoluteImageUrl(mainImage?.key);
    const canCarousel = safeImages.length > 1;

    function showToast(message: string, tone: BottomToastTone = "success") {
        setToastMessage(message);
        setToastTone(tone);
        setToastOpen(true);
    }

    function redirectToLogin() {
        const returnTo = pathname || `/${tenant}/goods/${data.id}`;
        showToast("로그인이 필요합니다. 다시 로그인해 주세요.", "error");
        window.setTimeout(() => {
            router.push(buildLoginHref(tenant, returnTo));
        }, 700);
    }

    function redirectToSettingsWithToast(message: string) {
        showToast(message, "error");
        window.setTimeout(() => {
            router.push(`/${tenant}/settings`);
        }, 700);
    }

    function adjustQty(optionId: string, delta: number) {
        const opt = optionById.get(optionId);
        if (!opt) return;
        if (delta > 0 && opt.soldout) return;

        setQty((prev) => {
            const cur = prev[optionId] ?? 0;
            const maxQty = getMaxSelectableQty(opt);
            const next = Math.max(0, cur + delta);

            if (maxQty !== Number.POSITIVE_INFINITY && next > maxQty) {
                return { ...prev, [optionId]: maxQty };
            }

            return { ...prev, [optionId]: next };
        });
    }

    function submitCart() {
        if (!isActive) {
            showToast("옵션을 선택해주세요.", "error");
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
                thumbnailUrl: mainImageUrl || undefined,
                tenant,
                rawOptionId: line.rawOptionId,
                qtyType: line.qtyType,
                stockQty: line.qty,
                soldout: line.soldout,
                stockNote: line.stockNote,
                optionCode: line.code,
            }))
        );

        showToast("장바구니에 담았어요.");
    }

    async function submitQuickOrder() {
        if (!isActive || submitting) return;

        try {
            setSubmitting(true);

            const auth = await fetchAuthSession();
            if (!auth?.loggedIn || !auth?.member?.uid) {
                redirectToLogin();
                return;
            }

            const profile = readQuickOrderProfile(tenant);
            if (!isQuickOrderProfileComplete(profile)) {
                redirectToSettingsWithToast("주문자 정보를 먼저 설정해 주세요.");
                return;
            }

            const buyerName =
                String(profile?.nickname ?? "").trim() || String(auth.member?.name ?? "").trim();
            const buyerPhone =
                String(profile?.phone ?? "").trim() || String(auth.member?.phone ?? "").trim();

            if (!buyerName || !buyerPhone) {
                redirectToSettingsWithToast("주문자 정보를 먼저 설정해 주세요.");
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
                    buyerName,
                    buyerPhone,
                    receiverName: buyerName,
                    receiverPhone: buyerPhone,
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

            saveGuestOrderRef({
                tenant,
                orderNum: json.orderNum,
                phone: buyerPhone,
                buyerName,
                createdAt: new Date().toISOString(),
            });

            setQty((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((key) => {
                    next[key] = 0;
                });
                return next;
            });

            showToast("주문이 완료되었어요.");

            window.setTimeout(() => {
                router.replace(`/${tenant}/orders?highlight=${encodeURIComponent(json.orderNum ?? "")}`);
            }, 900);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "주문 처리 중 오류가 발생했습니다.";
            showToast(message, "error");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
            <main className="mx-auto w-full max-w-[520px] bg-white pb-28">
                <section className="bg-white px-4 pb-5 pt-4">
                    <div className="overflow-hidden rounded-[24px] border border-[color:var(--border)] bg-white shadow-sm">
                        <div className="relative bg-white">
                            <div className="aspect-square" />

                            {mainImageUrl ? (
                                <div className="absolute inset-0 flex items-center justify-center p-3">
                                    <img
                                        src={mainImageUrl}
                                        alt={data.title}
                                        className="max-h-full max-w-full object-contain"
                                    />
                                </div>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-sm font-semibold text-slate-400">
                                    이미지 없음
                                </div>
                            )}

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
                                        onClick={() =>
                                            setImgIdx((v) => (v + 1) % safeImages.length)
                                        }
                                        className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-sm font-black text-slate-800 shadow-sm"
                                        aria-label="다음 이미지"
                                    >
                                        ›
                                    </button>
                                </div>
                            ) : null}
                        </div>

                        {safeImages.length > 1 ? (
                            <div className="flex gap-2 overflow-x-auto px-4 py-4">
                                {safeImages.map((img, idx) => {
                                    const thumb = toAbsoluteImageUrl(img.key);
                                    const active = idx === imgIdx;

                                    return (
                                        <button
                                            key={`${img.key}_${idx}`}
                                            type="button"
                                            onClick={() => setImgIdx(idx)}
                                            className="shrink-0 overflow-hidden rounded-xl border bg-white"
                                            style={{
                                                borderColor: active ? "var(--accent)" : "var(--border)",
                                                boxShadow: active
                                                    ? "0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent)"
                                                    : "none",
                                            }}
                                        >
                                            <div className="flex h-16 w-16 items-center justify-center bg-white p-1">
                                                {thumb ? (
                                                    <img
                                                        src={thumb}
                                                        alt={`${data.title}-${idx + 1}`}
                                                        className="max-h-full max-w-full object-contain"
                                                    />
                                                ) : (
                                                    <div className="h-full w-full bg-slate-100" />
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>

                    <div className="mt-4 text-[26px] font-extrabold leading-snug tracking-[-0.03em] text-[color:var(--fg)]">
                        {data.title}
                    </div>

                    <div className="mt-3 text-[16px] font-bold text-[color:var(--fg)]">
                        {Number(data.price ?? 0).toLocaleString()}원
                    </div>

                    {(data.meta?.timeLeft || pickupPeriodText || data.meta?.pickupNote) ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {data.meta?.timeLeft ? (
                                <MetaBadge
                                    icon={<Clock3 size={14} strokeWidth={2} />}
                                    text={data.meta.timeLeft}
                                    tone="danger"
                                />
                            ) : null}

                            {pickupPeriodText ? (
                                <MetaBadge
                                    icon={<Truck size={14} strokeWidth={2} />}
                                    text={`픽업 기간 ${pickupPeriodText}`}
                                    tone="info"
                                />
                            ) : null}

                            {data.meta?.pickupNote ? (
                                <MetaBadge
                                    icon={<Info size={14} strokeWidth={2} />}
                                    text={data.meta.pickupNote}
                                    tone="default"
                                />
                            ) : null}
                        </div>
                    ) : null}
                </section>

                <section className="border-t border-[color:var(--border)] bg-white px-4 py-5">
                    {descRaw ? (
                        descIsHtml ? (
                            <div
                                className="prose prose-sm max-w-none [&_img]:mx-auto [&_img]:h-auto [&_img]:max-w-full [&_img]:object-contain"
                                dangerouslySetInnerHTML={{ __html: descHtml }}
                            />
                        ) : (
                            <div className="whitespace-pre-wrap text-[16px] leading-8 text-[color:var(--fg)]">
                                {descRaw}
                            </div>
                        )
                    ) : (
                        <div className="text-[14px] font-semibold text-[color:var(--muted)]">
                            등록된 상세 설명이 없습니다.
                        </div>
                    )}
                </section>

                <section className="border-t border-[color:var(--border)] bg-white px-3 pb-4 pt-4">
                    <div className="space-y-3">
                        {data.options.map((option) => {
                            const optionQty = qty[option.id] ?? 0;
                            const soldout = !!option.soldout;
                            const maxQty = getMaxSelectableQty(option);
                            const isMaxReached =
                                maxQty !== Number.POSITIVE_INFINITY && optionQty >= maxQty;
                            const stockText =
                                option.stockNote?.trim() || "전량 한정! 조기 마감될 수 있습니다.";
                            const displayPrice = Number(option.price ?? data.price ?? 0);

                            return (
                                <div
                                    key={option.id}
                                    className="flex items-center justify-between gap-3 rounded-[22px] border bg-white p-4 shadow-sm"
                                    style={{
                                        borderColor: "var(--border)",
                                        opacity: soldout ? 0.6 : 1,
                                    }}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[12px] font-semibold text-rose-500">
                                            {stockText}
                                        </div>

                                        <div className="mt-1 text-[22px] font-extrabold leading-snug tracking-[-0.02em] text-[color:var(--fg)]">
                                            {option.name}
                                        </div>

                                        {option.addPrice ? (
                                            <div className="mt-1 text-[13px] font-bold text-rose-500">
                                                ({formatAddPrice(option.addPrice)})
                                            </div>
                                        ) : null}

                                        <div className="mt-2 text-[16px] text-[color:var(--muted)]">
                                            {displayPrice.toLocaleString()}원
                                        </div>
                                    </div>

                                    {soldout ? (
                                        <div className="flex h-10 min-w-[70px] items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-400">
                                            품절
                                        </div>
                                    ) : (
                                        <QtyControl
                                            value={optionQty}
                                            disabled={isMaxReached}
                                            onMinus={() => adjustQty(option.id, -1)}
                                            onPlus={() => adjustQty(option.id, 1)}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                <div className="fixed inset-x-0 bottom-0 z-30 px-3">
                    <div className="mx-auto w-full max-w-[520px] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={submitCart}
                                disabled={!isActive}
                                className="h-12 flex-[2.2] rounded-[12px] border bg-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                                style={{
                                    borderColor: "var(--accent)",
                                    color: "var(--accent)",
                                }}
                                aria-label="장바구니 담기"
                            >
                                <span className="flex items-center justify-center">
                                    <ShoppingCart size={20} />
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={submitQuickOrder}
                                disabled={!isActive || submitting}
                                className="relative h-12 flex-[7.8] rounded-[12px] font-bold text-white transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed"
                                style={{
                                    background: isActive
                                        ? "var(--accent)"
                                        : "color-mix(in srgb, var(--accent) 55%, white)",
                                    boxShadow: isActive
                                        ? "0 10px 22px color-mix(in srgb, var(--accent) 30%, transparent)"
                                        : "none",
                                    opacity: isActive ? 1 : 0.75,
                                }}
                            >
                                <div className="relative flex w-full items-center justify-center">
                                    <span className="inline-flex items-center gap-2">
                                        <ShoppingBag size={18} />
                                        {submitting ? "주문 처리 중..." : "주문하기"}
                                    </span>

                                    {isActive ? (
                                        <span className="absolute inset-y-0 right-4 flex flex-col items-end justify-center text-right">
                                            <span className="text-[13px] opacity-90">총 {totalQty}개</span>
                                            <span className="text-[13px] opacity-90">
                                                {totalPrice.toLocaleString()}원
                                            </span>
                                        </span>
                                    ) : null}
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            <BottomToast
                open={toastOpen}
                message={toastMessage}
                tone={toastTone}
                onClose={() => setToastOpen(false)}
            />
        </>
    );
}