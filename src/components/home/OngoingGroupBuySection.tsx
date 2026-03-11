// src/components/home/OngoingGroupBuySection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { endpoints } from "@/lib/api/endpoints";

type NoticeItem = {
    id: string;
    maskedName: string;
    minutesAgo: number;
    qty: number;
};

type OptionItem = {
    id: string;
    name: string;
    price: number | null;
    soldout?: boolean;
    stockNote?: string;

    // 실제 주문 API에 전달할 원본 옵션 인덱스/번호
    rawOptionId?: number | string;
};

export type OngoingGroupBuyItem = {
    id: string;
    tenant: string;
    title: string;
    price: number;
    images: { key: string; label?: string }[];
    options: OptionItem[];
    meta?: {
        timeLeft?: string;
        pickup?: string;
    };
    notice?: NoticeItem;

    // 디자인/프리뷰 확인용 선택 필드
    isMockPreview?: boolean;
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

function formatAgo(minutesAgo: number) {
    if (minutesAgo <= 0) return "방금";
    if (minutesAgo < 60) return `${minutesAgo}분 전`;
    const hours = Math.floor(minutesAgo / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
}

function formatPickupText(pickup?: string) {
    return pickup?.trim() || "픽업일 정보 없음";
}

function makeMockNotices(seed: string): NoticeItem[] {
    return [
        { id: `${seed}_1`, maskedName: "제**5**", minutesAgo: 1, qty: 10 },
        { id: `${seed}_2`, maskedName: "금****8", minutesAgo: 2, qty: 1 },
        { id: `${seed}_3`, maskedName: "김**3*", minutesAgo: 3, qty: 2 },
        { id: `${seed}_4`, maskedName: "박***2", minutesAgo: 4, qty: 5 },
        { id: `${seed}_5`, maskedName: "최**7*", minutesAgo: 5, qty: 3 },
        { id: `${seed}_6`, maskedName: "임***9", minutesAgo: 6, qty: 7 },
    ];
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

function toNumberOrZero(v: unknown) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function buildOptionKey(productId: string | number, optionId: string | number) {
    return `${String(productId)}__${String(optionId)}`;
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
                "pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex justify-center px-4 transition-all duration-300",
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

function CompactNoticeBar({
                              notice,
                              animateClass = "",
                          }: {
    notice?: NoticeItem;
    animateClass?: string;
}) {
    if (!notice) return null;

    return (
        <div
            className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 shadow-sm transition-all duration-300 ${animateClass}`}
            style={{
                background: "var(--accent-soft)",
                borderColor: "rgba(240, 138, 42, 0.18)",
            }}
        >
            <div className="flex min-w-0 items-center gap-2">
                <span
                    className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border text-[10px]"
                    style={{
                        background: "rgba(255,255,255,0.72)",
                        borderColor: "rgba(240, 138, 42, 0.16)",
                        color: "var(--accent-strong)",
                    }}
                >
                    ✓
                </span>

                <div
                    className="min-w-0 truncate text-[12px] font-bold leading-none"
                    style={{ color: "var(--brand-strong)" }}
                >
                    <span>{notice.maskedName}</span>
                    <span style={{ color: "var(--muted)" }}> 님이 </span>
                    <span style={{ color: "var(--brand)" }}>{formatAgo(notice.minutesAgo)}</span>
                    <span style={{ color: "var(--accent-strong)" }}> {notice.qty}개</span>
                    <span style={{ color: "var(--muted)" }}>를 주문했어요</span>
                </div>
            </div>

            <span className="shrink-0 text-[12px]" style={{ color: "var(--accent-strong)" }}>
                📈
            </span>
        </div>
    );
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
        <div className="flex items-center gap-3">
            <button
                type="button"
                onClick={onMinus}
                disabled={disabled || value <= 0}
                className="flex h-10 w-10 items-center justify-center rounded-full border bg-white text-[22px] font-black leading-none disabled:opacity-35"
                style={{
                    borderColor: "var(--border)",
                    color: value > 0 ? "var(--brand)" : "var(--muted)",
                }}
            >
                −
            </button>

            <div
                className="min-w-[18px] text-center text-[24px] font-extrabold tabular-nums"
                style={{ color: "var(--fg)" }}
            >
                {value}
            </div>

            <button
                type="button"
                onClick={onPlus}
                disabled={disabled}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[22px] font-black leading-none text-white shadow-sm disabled:opacity-40"
                style={{
                    background: disabled ? "#b9c3c6" : "var(--brand)",
                }}
            >
                +
            </button>
        </div>
    );
}

function GroupBuyCard({
                          item,
                          qtyMap,
                          onMinus,
                          onPlus,
                      }: {
    item: OngoingGroupBuyItem;
    qtyMap: Record<string, number>;
    onMinus: (optionKey: string) => void;
    onPlus: (optionKey: string) => void;
}) {
    const images = useMemo(() => {
        const raw = (item.images ?? []).filter((img) => img?.key);
        return raw.length ? raw : [{ key: "", label: "이미지 없음" }];
    }, [item.images]);

    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    const normalizedOptions = useMemo(() => {
        if (item.options?.length) return item.options;

        return [
            {
                id: `base_${item.id}`,
                name: item.title,
                price: item.price,
                soldout: false,
                rawOptionId: 0,
            },
        ];
    }, [item.id, item.options, item.price, item.title]);

    const mockNotices = useMemo(() => makeMockNotices(item.id), [item.id]);
    const [noticeIndex, setNoticeIndex] = useState(0);
    const [noticeVisible, setNoticeVisible] = useState(true);

    useEffect(() => {
        if (mockNotices.length <= 1) return;

        const timer = window.setInterval(() => {
            setNoticeVisible(false);

            window.setTimeout(() => {
                setNoticeIndex((prev) => (prev + 1) % mockNotices.length);
                setNoticeVisible(true);
            }, 220);
        }, 5000);

        return () => window.clearInterval(timer);
    }, [mockNotices.length]);

    const currentNotice = mockNotices[noticeIndex] ?? item.notice;

    return (
        <article
            className="mt-6 rounded-[28px] border px-3 py-3 shadow-sm"
            style={{
                background: "var(--surface)",
                borderColor: "rgba(23,59,69,0.09)",
                boxShadow: "0 8px 22px rgba(15, 42, 49, 0.06)",
            }}
        >
            <CompactNoticeBar
                notice={currentNotice}
                animateClass={noticeVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}
            />

            <div className="mt-3 grid grid-cols-3 gap-2.5">
                {images.slice(0, 3).map((img, idx) => (
                    <button
                        key={`${item.id}_${idx}`}
                        type="button"
                        onClick={() => setSelectedImageIndex(idx)}
                        className="overflow-hidden rounded-2xl border bg-white"
                        style={{
                            borderColor:
                                idx === selectedImageIndex ? "var(--brand)" : "rgba(23,59,69,0.08)",
                            boxShadow:
                                idx === selectedImageIndex ? "0 0 0 2px rgba(23,59,69,0.08)" : "none",
                        }}
                    >
                        <div className="aspect-[1/1] overflow-hidden" style={{ background: "var(--brand-soft)" }}>
                            {img.key ? (
                                <img src={img.key} alt={item.title} className="h-full w-full object-cover" />
                            ) : (
                                <div className="h-full w-full bg-gradient-to-br from-white to-[color:var(--brand-soft)]" />
                            )}
                        </div>
                    </button>
                ))}
            </div>

            {images[selectedImageIndex]?.key ? (
                <div className="sr-only">
                    <img src={images[selectedImageIndex].key} alt={item.title} />
                </div>
            ) : null}

            <div className="mt-4">
                <h3
                    className="text-[18px] font-extrabold leading-snug tracking-[-0.02em]"
                    style={{ color: "var(--fg)" }}
                >
                    {item.title}
                </h3>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {item.meta?.timeLeft ? (
                        <span
                            className="inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-bold"
                            style={{
                                borderColor: "rgba(240,138,42,0.28)",
                                background: "var(--accent-soft)",
                                color: "var(--accent-strong)",
                            }}
                        >
                            ⏰ {item.meta.timeLeft}
                        </span>
                    ) : null}

                    <span
                        className="inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-bold"
                        style={{
                            borderColor: "var(--border)",
                            background: "#fff",
                            color: "var(--muted)",
                        }}
                    >
                        🚚 {formatPickupText(item.meta?.pickup)}
                    </span>
                </div>
            </div>

            <div className="mt-4 space-y-3">
                {normalizedOptions.map((option) => {
                    const optionKey = buildOptionKey(item.id, option.id);
                    const qty = qtyMap[optionKey] ?? 0;
                    const soldout = !!option.soldout;
                    const displayPrice = Number(option.price ?? item.price ?? 0);

                    return (
                        <section
                            key={optionKey}
                            className="rounded-[24px] border px-4 py-4"
                            style={{
                                borderColor: "rgba(23,59,69,0.08)",
                                background: "linear-gradient(180deg, #ffffff 0%, #fcfbf8 100%)",
                            }}
                        >
                            <div className="text-[12px] font-bold" style={{ color: "var(--accent)" }}>
                                🎉 전점 한정! 조기 마감될 수 있습니다.
                            </div>

                            <div
                                className="mt-2 text-[19px] font-extrabold leading-snug"
                                style={{ color: "var(--fg)" }}
                            >
                                {option.name}
                            </div>

                            <div className="mt-2 text-[15px] font-extrabold" style={{ color: "var(--brand)" }}>
                                {displayPrice.toLocaleString()}원
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3">
                                <div className="text-[13px] font-semibold" style={{ color: "var(--muted)" }}>
                                    {soldout ? "품절" : option.stockNote || "주문 가능"}
                                </div>

                                <QtyControl
                                    value={qty}
                                    disabled={soldout}
                                    onMinus={() => onMinus(optionKey)}
                                    onPlus={() => onPlus(optionKey)}
                                />
                            </div>
                        </section>
                    );
                })}
            </div>
        </article>
    );
}

export default function OngoingGroupBuySection({
                                                   title = "진행 중인 공구",
                                                   items,
                                               }: {
    title?: string;
    items: OngoingGroupBuyItem[];
}) {
    const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
    const [submitting, setSubmitting] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);

    useEffect(() => {
        if (!toastOpen) return;

        const timer = window.setTimeout(() => {
            setToastOpen(false);
        }, 1800);

        return () => window.clearTimeout(timer);
    }, [toastOpen]);

    const optionPriceMap = useMemo(() => {
        const map: Record<string, number> = {};

        for (const item of items ?? []) {
            const options =
                item.options?.length
                    ? item.options
                    : [
                        {
                            id: `base_${item.id}`,
                            name: item.title,
                            price: item.price,
                            rawOptionId: 0,
                        },
                    ];

            for (const option of options) {
                const optionKey = buildOptionKey(item.id, option.id);
                map[optionKey] = Number(option.price ?? item.price ?? 0);
            }
        }

        return map;
    }, [items]);

    const optionMetaMap = useMemo(() => {
        const map = new Map<
            string,
            {
                tenant: string;
                productId: string;
                optionId: string;
                rawOptionId: number;
                optionName: string;
            }
        >();

        for (const item of items ?? []) {
            const options =
                item.options?.length
                    ? item.options
                    : [
                        {
                            id: `base_${item.id}`,
                            name: item.title,
                            price: item.price,
                            rawOptionId: 0,
                        },
                    ];

            for (const option of options) {
                const rawOptionId = toNumberOrZero(option.rawOptionId);
                const optionKey = buildOptionKey(item.id, option.id);

                map.set(optionKey, {
                    tenant: item.tenant,
                    productId: String(item.id),
                    optionId: String(option.id),
                    rawOptionId,
                    optionName: option.name,
                });
            }
        }

        return map;
    }, [items]);

    const totalQty = Object.values(qtyMap).reduce((sum, qty) => sum + qty, 0);

    const totalPrice = Object.entries(qtyMap).reduce((sum, [optionKey, qty]) => {
        return sum + (optionPriceMap[optionKey] ?? 0) * qty;
    }, 0);

    const isActive = totalQty > 0;

    function minus(optionKey: string) {
        setQtyMap((prev) => ({
            ...prev,
            [optionKey]: Math.max(0, (prev[optionKey] ?? 0) - 1),
        }));
    }

    function plus(optionKey: string) {
        setQtyMap((prev) => ({
            ...prev,
            [optionKey]: (prev[optionKey] ?? 0) + 1,
        }));
    }

    async function submitQuickOrder() {
        if (!isActive || submitting) return;

        const firstTenant = String(items?.[0]?.tenant ?? "").trim();
        if (!firstTenant) {
            alert("지점 정보가 올바르지 않습니다.");
            return;
        }

        const profile = readQuickOrderProfile(firstTenant);
        if (!profile) {
            alert("빠른 주문을 하려면 설정에서 닉네임/전화번호를 먼저 저장해 주세요.");
            return;
        }

        const selectedItems = Object.entries(qtyMap)
            .filter(([, qty]) => Number(qty) > 0)
            .map(([optionKey, qty]) => {
                const meta = optionMetaMap.get(optionKey);
                if (!meta) return null;

                return {
                    productId: Number(meta.productId),
                    optionId: meta.rawOptionId,
                    optionName: meta.optionName,
                    qty: Number(qty),
                };
            })
            .filter(Boolean);

        if (!selectedItems.length) {
            alert("주문할 수량을 선택해 주세요.");
            return;
        }

        setSubmitting(true);

        try {
            const res = await fetch(endpoints.createOrder(firstTenant), {
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
                    memo: "홈페이지 빠른주문",
                    direct: 1,
                    items: selectedItems,
                }),
            });

            const json = (await res.json().catch(() => ({}))) as CreateOrderResponse;

            if (!res.ok || json?.ok === false || !json?.orderNum) {
                throw new Error(json?.message || `주문 생성 실패 (HTTP ${res.status})`);
            }

            setQtyMap({});
            setToastOpen(true);
        } catch (e: any) {
            alert(e?.message || "주문 처리 중 오류가 발생했습니다.");
        } finally {
            setSubmitting(false);
        }
    }

    if (!items?.length) {
        return (
            <section className="mt-8">
                <div className="text-[28px] font-extrabold tracking-[-0.03em]" style={{ color: "var(--fg)" }}>
                    🔥 {title}
                </div>

                <div
                    className="mt-3 rounded-2xl border p-4 text-sm font-semibold"
                    style={{
                        background: "var(--surface)",
                        borderColor: "var(--border)",
                        color: "var(--muted)",
                    }}
                >
                    진행 중인 공구가 없습니다.
                </div>
            </section>
        );
    }

    return (
        <>
            <section className="mt-8 pb-28">
                <div className="text-[28px] font-extrabold tracking-[-0.03em]" style={{ color: "var(--fg)" }}>
                    🔥 {title}
                </div>

                <div className="mt-3">
                    {items.map((item) => (
                        <GroupBuyCard
                            key={item.id}
                            item={item}
                            qtyMap={qtyMap}
                            onMinus={minus}
                            onPlus={plus}
                        />
                    ))}
                </div>

                <div className="fixed bottom-4 left-0 right-0 z-40">
                    <div className="mx-auto w-full max-w-[520px] px-4">
                        <button
                            type="button"
                            onClick={submitQuickOrder}
                            disabled={!isActive || submitting}
                            className="relative flex h-14 w-full items-center justify-center rounded-[18px] px-5 text-white transition-all duration-200"
                            style={{
                                background: isActive
                                    ? "linear-gradient(180deg, var(--brand) 0%, var(--brand-strong) 100%)"
                                    : "linear-gradient(180deg, rgba(23,59,69,0.42) 0%, rgba(15,42,49,0.38) 100%)",
                                color: "#ffffff",
                                opacity: isActive ? 1 : 0.45,
                                boxShadow: isActive
                                    ? "0 12px 28px rgba(15,42,49,0.22)"
                                    : "0 8px 18px rgba(15,42,49,0.10)",
                                backdropFilter: "blur(6px)",
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-[20px]">🛒</span>
                                <span className="text-[16px] font-extrabold tracking-[-0.02em]">
                                    {submitting ? "주문 처리 중..." : "주문하기"}
                                </span>
                            </div>

                            {isActive ? (
                                <div className="absolute right-5 text-right">
                                    <div className="text-[13px] font-bold opacity-90">총 {totalQty}개</div>
                                    <div className="text-[15px] font-extrabold">{totalPrice.toLocaleString()}원</div>
                                </div>
                            ) : null}
                        </button>
                    </div>
                </div>
            </section>

            <SuccessToast
                open={toastOpen}
                message="주문이 완료되었어요"
                onClose={() => setToastOpen(false)}
            />
        </>
    );
}