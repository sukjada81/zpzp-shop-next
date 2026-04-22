// src/components/home/OngoingGroupBuySection.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, Clock3, Truck } from "lucide-react";
import BottomToast, { BottomToastTone } from "@/components/ui/BottomToast";
import { endpoints } from "@/lib/api/endpoints";
import { saveGuestOrderRef } from "@/lib/orders/guestOrderRefs";
import {
    isQuickOrderProfileComplete,
    readQuickOrderProfile,
} from "@/lib/profile/quickOrderProfile";
import type { RecentOrderTickerItem } from "@/components/home/RecentOrderTicker";

// ─── Types ───────────────────────────────────────────────────────────────────

type OptionItem = {
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

export type OngoingGroupBuyItem = {
    id: string;
    tenant: string;
    title: string;
    price: number;
    href?: string;
    images: { key: string; label?: string }[];
    options: OptionItem[];
    meta?: {
        timeLeft?: string;
        deadlineAt?: string | null;
        pickup?: string;
        pickupStartAt?: string | null;
        pickupEndAt?: string | null;
    };
    recentOrders: RecentOrderTickerItem[];
};

type CreateOrderResponse = {
    ok: boolean;
    orderNum?: string;
    message?: string;
    error?: string;
    detail?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAgo(minutesAgo: number) {
    if (minutesAgo <= 0) return "방금";
    if (minutesAgo < 60) return `${minutesAgo}분 전`;
    const h = Math.floor(minutesAgo / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
}

function toNumberOrZero(v: unknown) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function buildOptionKey(productId: string | number, optionId: string | number) {
    return `${String(productId)}__${String(optionId)}`;
}

function getMaxSelectableQty(option?: OptionItem) {
    if (!option) return Number.POSITIVE_INFINITY;
    if (Number(option.qtyType ?? 1) === 1) return Number.POSITIVE_INFINITY;
    const qty = Number(option.qty ?? 0);
    return qty > 0 ? qty : 0;
}

function formatAddPrice(v?: number) {
    const n = Number(v ?? 0);
    if (!n) return "";
    return n > 0 ? `+${n.toLocaleString()}원` : `${n.toLocaleString()}원`;
}

function toAbsUrl(key?: string) {
    const k = String(key ?? "").trim();
    if (!k) return "";
    if (/^https?:\/\//i.test(k)) return k;
    const base = (process.env.NEXT_PUBLIC_ASSET_ORIGIN || "").replace(/\/$/, "");
    return base ? `${base}${k.startsWith("/") ? "" : "/"}${k}` : k.startsWith("/") ? k : `/${k}`;
}

// ─── Per-item rolling notice ticker ──────────────────────────────────────────

function ItemNoticeTicker({ items }: { items: RecentOrderTickerItem[] }) {
    const [idx, setIdx] = useState(0);

    useEffect(() => {
        if (items.length <= 1) return;
        const t = setInterval(() => setIdx((p) => (p + 1) % items.length), 4000);
        return () => clearInterval(t);
    }, [items.length]);

    if (!items.length) return null;

    const cur = items[idx % items.length];

    return (
        <div
            className="w-full rounded-[12px] border px-3 py-2.5"
            style={{
                borderColor: "color-mix(in srgb, var(--accent) 28%, transparent)",
                background: "color-mix(in srgb, var(--accent) 5%, white)",
            }}
        >
            <div className="flex items-center gap-2">
                <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px]"
                    style={{ borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)" }}
                >
                    ✅
                </span>
                <span className="text-[13px] leading-snug text-[color:var(--fg)]">
                    <span className="font-extrabold" style={{ color: "var(--accent)" }}>
                        {cur.maskedName}
                    </span>{" "}
                    님이{" "}
                    <span className="font-bold" style={{ color: "var(--accent)" }}>
                        {formatAgo(cur.minutesAgo)}
                    </span>{" "}
                    <span className="font-bold" style={{ color: "var(--accent)" }}>
                        {cur.qty}개
                    </span>
                    를 주문했어요
                </span>
            </div>
        </div>
    );
}

// ─── Image gallery ────────────────────────────────────────────────────────────

function ImageGallery({
    images,
    title,
}: {
    images: { key: string; label?: string }[];
    title: string;
}) {
    const list = images?.length ? images : [{ key: "", label: "이미지 없음" }];

    const touchStartX = useRef<number | null>(null);
    const [activeIdx, setActiveIdx] = useState(0);

    function handleTouchStart(e: React.TouchEvent) {
        touchStartX.current = e.touches[0].clientX;
    }

    function handleTouchEnd(e: React.TouchEvent) {
        if (touchStartX.current === null || list.length <= 1) return;
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        touchStartX.current = null;
        if (Math.abs(diff) < 40) return;
        if (diff > 0) setActiveIdx((v) => Math.min(v + 1, list.length - 1));
        else setActiveIdx((v) => Math.max(v - 1, 0));
    }

    return (
        <div className="relative">
            <div
                className="-mx-3 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div className="flex gap-2 px-3">
                    {list.map((img, i) => {
                        const url = toAbsUrl(img.key);

                        return (
                            <div
                                key={`${img.key}_${i}`}
                                className="relative flex-shrink-0 overflow-hidden rounded-xl border bg-white"
                                style={{
                                    width: 160,
                                    height: 160,
                                    borderColor: "var(--border)",
                                }}
                                onClick={() => setActiveIdx(i)}
                            >
                                {url ? (
                                    <img
                                        src={url}
                                        alt={img.label || `${title} 이미지`}
                                        className="h-full w-full object-cover"
                                        draggable={false}
                                    />
                                ) : (
                                    <div className="h-full w-full bg-slate-100" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(deadlineAt?: string | null, fallback?: string) {
    const [text, setText] = useState(fallback || "진행 중");

    useEffect(() => {
        if (!deadlineAt) return;

        function tick() {
            const ms = new Date(deadlineAt!).getTime() - Date.now();
            if (ms <= 0) {
                setText("마감");
                return;
            }
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            const s = Math.floor((ms % 60000) / 1000);

            if (h > 0) setText(`${h}시간 ${m}분 뒤 마감`);
            else if (m > 0) setText(`${m}분 ${s}초 뒤 마감`);
            else setText(`${s}초 뒤 마감`);
        }

        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, [deadlineAt]);

    return text;
}

// ─── Qty control ──────────────────────────────────────────────────────────────

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
                aria-label="감소"
                className="flex h-9 w-9 items-center justify-center rounded-full border text-lg font-medium transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ borderColor: "var(--border)", background: "#fff", color: "var(--muted)" }}
            >
                −
            </button>
            <div className="min-w-[2rem] text-center text-base font-semibold text-[color:var(--fg)]">
                {value}
            </div>
            <button
                onClick={onPlus}
                disabled={disabled}
                type="button"
                aria-label="증가"
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-medium text-white transition-all active:scale-95 disabled:opacity-40"
                style={{
                    background: "var(--accent)",
                    boxShadow: "0 4px 10px color-mix(in srgb, var(--accent) 28%, transparent)",
                }}
            >
                +
            </button>
        </div>
    );
}

// ─── Single group-buy item block ──────────────────────────────────────────────

function GroupBuyItemBlock({
    item,
    qtyMap,
    onMinus,
    onPlus,
}: {
    item: OngoingGroupBuyItem;
    qtyMap: Record<string, number>;
    onMinus: (key: string) => void;
    onPlus: (key: string) => void;
}) {
    const options = useMemo(() => {
        if (item.options?.length) return item.options;
        return [{ id: `base_${item.id}`, name: item.images?.[0]?.label?.trim() || item.title, price: item.price, soldout: false, rawOptionId: 0 }];
    }, [item]);

    const deadlineText = useCountdown(item.meta?.deadlineAt, item.meta?.timeLeft);
    const pickupText = item.meta?.pickup?.trim() || "";

    return (
        <article
            className="rounded-[24px] border px-3 py-3"
            style={{
                background: "var(--surface, #fff)",
                borderColor: "color-mix(in srgb, var(--border) 80%, transparent)",
                boxShadow: "0 6px 20px rgba(0,0,0,0.05)",
            }}
        >
            {/* 주문 알림 */}
            <ItemNoticeTicker items={item.recentOrders} />

            {/* 이미지 갤러리 */}
            <div className="mt-3">
                <ImageGallery images={item.images} title={item.title} />
            </div>

            {/* 제목 + 뱃지 */}
            <Link href={item.href || "#"} className="mt-3 block">
                <div className="text-[17px] font-extrabold leading-snug tracking-[-0.03em] text-[color:var(--fg)] line-clamp-2">
                    {item.title}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                        className="inline-flex h-[26px] items-center gap-1 rounded-full border px-3 text-[12px] font-semibold"
                        style={{ borderColor: "var(--border-danger, #ffd6d6)", background: "var(--surface-danger, #fff5f5)", color: "var(--fg-danger, #e53e3e)" }}
                    >
                        <Clock3 size={13} strokeWidth={2} />
                        <span>{deadlineText}</span>
                    </span>

                    {pickupText ? (
                        <span
                            className="inline-flex min-h-[26px] items-center gap-1 rounded-full border px-3 py-0.5 text-[12px] font-semibold"
                            style={{ borderColor: "var(--border-info, #c7d7ff)", background: "var(--surface-info, #f5f8ff)", color: "var(--fg-info, #5b7cff)" }}
                        >
                            <Truck size={13} strokeWidth={2} />
                            <span>{pickupText}</span>
                        </span>
                    ) : null}
                </div>
            </Link>

            {/* 옵션 수량 카드 */}
            <div className="mt-4 space-y-2">
                {options.map((option) => {
                    const key = buildOptionKey(item.id, option.id);
                    const qty = qtyMap[key] ?? 0;
                    const price = Number(option.price ?? item.price ?? 0);
                    const soldout = !!option.soldout;
                    const stockText = option.stockNote?.trim() || "전량 한정! 조기 마감될 수 있습니다.";
                    const maxQty = getMaxSelectableQty(option);
                    const isMax = maxQty !== Number.POSITIVE_INFINITY && qty >= maxQty;

                    return (
                        <div
                            key={key}
                            className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm"
                            style={{ borderColor: "var(--border)", opacity: soldout ? 0.6 : 1 }}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-semibold text-rose-500">{stockText}</div>
                                <div className="mt-1 font-semibold text-[color:var(--fg)]">
                                    {option.name}
                                    {option.addPrice ? (
                                        <span className="ml-1 text-[12px] font-bold text-rose-500">
                                            ({formatAddPrice(option.addPrice)})
                                        </span>
                                    ) : null}
                                </div>
                                <div className="mt-1 text-[14px] text-[color:var(--muted)]">
                                    {price.toLocaleString()}원
                                </div>
                            </div>

                            {soldout ? (
                                <div className="flex h-9 min-w-[64px] items-center justify-center rounded-xl bg-slate-100 px-3 text-sm font-bold text-slate-400">
                                    품절
                                </div>
                            ) : (
                                <QtyControl
                                    value={qty}
                                    disabled={isMax}
                                    onMinus={() => onMinus(key)}
                                    onPlus={() => onPlus(key)}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </article>
    );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function OngoingGroupBuySection({
    title = "🔥 진행 중인 공구",
    items,
    showOrderBar = true,
}: {
    title?: string;
    items: OngoingGroupBuyItem[];
    showOrderBar?: boolean;
}) {
    const router = useRouter();
    const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
    const [submitting, setSubmitting] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastTone, setToastTone] = useState<BottomToastTone>("success");

    useEffect(() => {
        if (!toastOpen) return;
        const t = setTimeout(() => setToastOpen(false), 1800);
        return () => clearTimeout(t);
    }, [toastOpen]);

    const displayItems = useMemo(() => items ?? [], [items]);

    // option key → meta 매핑
    const optionMetaMap = useMemo(() => {
        const map = new Map<string, {
            tenant: string;
            productId: string;
            rawOptionId: number;
            optionName: string;
            qty?: number;
            qtyType?: number;
            soldout?: boolean;
        }>();

        for (const item of displayItems) {
            const opts = item.options?.length
                ? item.options
                : [{ id: `base_${item.id}`, name: item.title, price: item.price, rawOptionId: 0 }];

            for (const opt of opts) {
                map.set(buildOptionKey(item.id, opt.id), {
                    tenant: item.tenant,
                    productId: String(item.id),
                    rawOptionId: toNumberOrZero(opt.rawOptionId),
                    optionName: opt.name,
                    qty: opt.qty,
                    qtyType: opt.qtyType,
                    soldout: opt.soldout,
                });
            }
        }

        return map;
    }, [displayItems]);

    // option key → 단가
    const optionPriceMap = useMemo(() => {
        const map: Record<string, number> = {};
        for (const item of displayItems) {
            const opts = item.options?.length
                ? item.options
                : [{ id: `base_${item.id}`, price: item.price }];
            for (const opt of opts) {
                map[buildOptionKey(item.id, opt.id)] = Number(opt.price ?? item.price ?? 0);
            }
        }
        return map;
    }, [displayItems]);

    const selectedEntries = useMemo(
        () => Object.entries(qtyMap).filter(([k, q]) => q > 0 && optionMetaMap.has(k)),
        [qtyMap, optionMetaMap]
    );

    const totalQty = selectedEntries.reduce((s, [, q]) => s + q, 0);
    const totalPrice = selectedEntries.reduce((s, [k, q]) => s + (optionPriceMap[k] ?? 0) * q, 0);
    const isActive = totalQty > 0;

    function showToast(msg: string, tone: BottomToastTone = "success") {
        setToastMessage(msg);
        setToastTone(tone);
        setToastOpen(true);
    }

    function minus(key: string) {
        setQtyMap((p) => ({ ...p, [key]: Math.max(0, (p[key] ?? 0) - 1) }));
    }

    function plus(key: string) {
        const meta = optionMetaMap.get(key);
        if (!meta || meta.soldout) return;
        const max = Number(meta.qtyType ?? 1) === 1 ? Number.POSITIVE_INFINITY : Math.max(0, Number(meta.qty ?? 0));
        setQtyMap((p) => {
            const next = (p[key] ?? 0) + 1;
            return { ...p, [key]: max === Number.POSITIVE_INFINITY ? next : Math.min(next, max) };
        });
    }

    async function submitOrder() {
        if (!isActive || submitting) return;

        const firstTenant = String(displayItems[0]?.tenant ?? "").trim();
        if (!firstTenant) { showToast("지점 정보가 올바르지 않습니다.", "error"); return; }

        const profile = readQuickOrderProfile(firstTenant);
        if (!isQuickOrderProfileComplete(profile)) {
            showToast("주문자 정보를 먼저 설정해 주세요.", "error");
            setTimeout(() => router.push(`/${firstTenant}/settings`), 700);
            return;
        }

        const orderItems = selectedEntries
            .map(([key, qty]) => {
                const meta = optionMetaMap.get(key);
                if (!meta) return null;
                return { productId: Number(meta.productId), optionId: meta.rawOptionId || undefined, optionName: meta.optionName, qty };
            })
            .filter(Boolean);

        if (!orderItems.length) { showToast("주문할 수량을 선택해 주세요.", "error"); return; }

        setSubmitting(true);
        try {
            const res = await fetch(endpoints.createOrder(firstTenant), {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                credentials: "include",
                cache: "no-store",
                body: JSON.stringify({
                    buyerName: String(profile?.nickname ?? "").trim(),
                    buyerPhone: String(profile?.phone ?? "").trim(),
                    receiverName: String(profile?.nickname ?? "").trim(),
                    receiverPhone: String(profile?.phone ?? "").trim(),
                    pickupAt: null,
                    message: "",
                    memo: "진행중인공구 빠른주문",
                    direct: 1,
                    items: orderItems,
                }),
            });

            const json = (await res.json().catch(() => ({}))) as CreateOrderResponse;

            if (res.status === 401) {
                showToast("로그인이 필요합니다.", "error");
                setTimeout(() => router.push(`/${firstTenant}/login?returnTo=/${firstTenant}/groupbuys`), 700);
                return;
            }

            if (!res.ok || json?.ok === false || !json?.orderNum) {
                throw new Error(json?.message || json?.error || json?.detail || `주문 실패 (HTTP ${res.status})`);
            }

            saveGuestOrderRef({
                tenant: firstTenant,
                orderNum: json.orderNum,
                phone: String(profile?.phone ?? ""),
                buyerName: String(profile?.nickname ?? ""),
                createdAt: new Date().toISOString(),
            });

            setQtyMap({});
            showToast("주문이 완료되었어요.");
        } catch (e: unknown) {
            showToast(e instanceof Error ? e.message : "주문 처리 중 오류가 발생했습니다.", "error");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
            <section className="mt-6 pb-0">
                <div className="text-xl font-bold text-[color:var(--fg)]">{title}</div>

                {!displayItems.length ? (
                    <div className="mt-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm font-semibold text-[color:var(--muted)]">
                        진행 중인 공구가 없습니다.
                    </div>
                ) : (
                    <div className="mt-4 space-y-5">
                        {displayItems.map((item) => (
                            <GroupBuyItemBlock
                                key={item.id}
                                item={item}
                                qtyMap={qtyMap}
                                onMinus={minus}
                                onPlus={plus}
                            />
                        ))}
                    </div>
                )}

                {showOrderBar && displayItems.length ? (
                    <div className="fixed inset-x-0 bottom-0 z-30 px-3">
                        <div className="mx-auto w-full max-w-[520px] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
                            <button
                                type="button"
                                onClick={submitOrder}
                                disabled={!isActive || submitting}
                                className="relative h-12 w-full rounded-[12px] font-bold text-white transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed"
                                style={{
                                    background: isActive ? "var(--accent)" : "color-mix(in srgb, var(--accent) 55%, white)",
                                    boxShadow: isActive ? "0 10px 22px color-mix(in srgb, var(--accent) 30%, transparent)" : "none",
                                    opacity: isActive ? 1 : 0.65,
                                }}
                            >
                                <div className="relative flex w-full items-center justify-center">
                                    <span className="inline-flex items-center gap-2">
                                        <ShoppingBag size={18} />
                                        {submitting ? "주문 처리 중..." : "주문하기"}
                                    </span>
                                    {isActive ? (
                                        <span className="absolute inset-y-0 right-4 flex flex-col items-end justify-center text-right">
                                            <span className="text-[12px] opacity-90">총 {totalQty}개</span>
                                            <span className="text-[12px] opacity-90">{totalPrice.toLocaleString()}원</span>
                                        </span>
                                    ) : null}
                                </div>
                            </button>
                        </div>
                    </div>
                ) : null}
            </section>

            <BottomToast open={toastOpen} message={toastMessage} tone={toastTone} onClose={() => setToastOpen(false)} />
        </>
    );
}
