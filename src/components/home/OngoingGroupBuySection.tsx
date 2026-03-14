// src/components/home/OngoingGroupBuySection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBag, TrendingUp, Clock3, Truck } from "lucide-react";
import { endpoints } from "@/lib/api/endpoints";

/**
 * 상단 실시간 주문 알림용 데이터
 */
type NoticeItem = {
    id: string;
    maskedName: string;
    minutesAgo: number;
    qty: number;
};

/**
 * 옵션 데이터
 * - soldout: 품절 여부
 * - stockNote: "5개 남았습니다!", "한정수량 마감!" 같은 문구
 * - rawOptionId: 실제 주문 API에 전달할 원본 옵션 번호
 */
type OptionItem = {
    id: string;
    name: string;
    price: number | null;
    soldout?: boolean;
    stockNote?: string;
    rawOptionId?: number | string;
};

/**
 * 진행 중인 공구 카드 데이터
 */
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
        pickup?: string;
    };
    notice?: NoticeItem;
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

/**
 * "몇 분 전 / 몇 시간 전 / 며칠 전" 포맷
 */
function formatAgo(minutesAgo: number) {
    if (minutesAgo <= 0) return "방금";
    if (minutesAgo < 60) return `${minutesAgo}분 전`;
    const hours = Math.floor(minutesAgo / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
}

/**
 * 마감 시간 문구 기본값
 */
function formatTimeLeft(timeLeft?: string) {
    return timeLeft || "진행 중";
}

/**
 * 픽업 문구 기본값
 */
function formatPickupText(pickup?: string) {
    return pickup?.trim() || "픽업일 정보 없음";
}

/**
 * 상단 주문 알림 목업 데이터
 */
function makeMockNotices(seed: string): NoticeItem[] {
    return [
        { id: `${seed}_1`, maskedName: "손*이****", minutesAgo: 9, qty: 2 },
        { id: `${seed}_2`, maskedName: "영*8***", minutesAgo: 44, qty: 1 },
        { id: `${seed}_3`, maskedName: "명**9***", minutesAgo: 17, qty: 3 },
        { id: `${seed}_4`, maskedName: "김*진***", minutesAgo: 5, qty: 1 },
        { id: `${seed}_5`, maskedName: "박*민***", minutesAgo: 3, qty: 2 },
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

/**
 * 상단 실시간 주문 알림 바
 */
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
            className={`w-full rounded-[12px] border px-3 py-2 transition-all duration-300 ${animateClass}`}
            style={{
                borderColor: "rgba(240,127,34,0.30)",
                background: "rgba(240,127,34,0.06)",
            }}
        >
            <div className="flex items-center gap-2 text-sm text-neutral-700">
                <ShoppingBag
                    size={16}
                    strokeWidth={2}
                    className="flex-shrink-0"
                    style={{ color: "#f07f22" }}
                />

                <span className="leading-none">
                    <strong style={{ color: "#f07f22", fontWeight: 600 }}>
                        {notice.maskedName}
                    </strong>
                    <span> 님이 {formatAgo(notice.minutesAgo)} </span>
                    <span style={{ color: "#f07f22", fontWeight: 700 }}>
                        {notice.qty}개
                    </span>
                    <span>를 주문했어요</span>
                </span>

                <TrendingUp
                    size={14}
                    strokeWidth={2}
                    className="ml-auto flex-shrink-0"
                    style={{ color: "#f07f22" }}
                />
            </div>
        </div>
    );
}

/**
 * 옵션 수량 컨트롤
 */
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
                className="flex h-9 w-9 items-center justify-center rounded-full border text-lg font-medium transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                    borderColor: "#e5e7eb",
                    background: "#fff",
                    color: "#c8c8c8",
                }}
            >
                −
            </button>

            <div className="min-w-10 text-center text-base font-semibold text-neutral-800">
                {value}
            </div>

            <button
                onClick={onPlus}
                disabled={disabled}
                type="button"
                aria-label="increase"
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-medium text-white transition-all active:scale-95 disabled:opacity-40"
                style={{
                    background: "#f07f22",
                    boxShadow: "0 4px 10px rgba(240,127,34,0.25)",
                }}
            >
                +
            </button>
        </div>
    );
}

/**
 * 상단 썸네일 가로 리스트
 */
function ProductThumbStrip({
    images,
}: {
    images: { key: string; label?: string }[];
}) {
    const list = images?.length ? images : [{ key: "", label: "이미지 없음" }];

    return (
        <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-2">
                {list.map((img, idx) => (
                    <div
                        key={`${img.key}_${idx}`}
                        className="relative h-44 w-44 flex-shrink-0 overflow-hidden rounded-lg border bg-neutral-100"
                        style={{ borderColor: "#e5e7eb" }}
                    >
                        {img.key ? (
                            <img
                                alt={img.label || `thumb-${idx + 1}`}
                                src={img.key}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="h-full w-full bg-neutral-200" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * 공구 1개 블록
 */
function GroupBuyItemBlock({
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
    const options = useMemo(() => {
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
    }, [item]);

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
            }, 180);
        }, 5000);

        return () => window.clearInterval(timer);
    }, [mockNotices.length]);

    const currentNotice = mockNotices[noticeIndex] ?? item.notice;

    return (
        <article
            className="mt-6 mb-6 rounded-[28px] border px-3 py-3 shadow-sm"
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

            <div className="mt-3">
                <ProductThumbStrip images={item.images} />
            </div>

            <Link href={item.href || "#"} className="mt-3 block">
                <div
                    className="mb-1 line-clamp-2 text-[17px] font-extrabold leading-[1.4] tracking-[-0.03em]"
                    style={{ color: "#222222" }}
                >
                    {item.title}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {!item.isMockPreview ? (
                        <span
                            className="inline-flex h-[25px] items-center gap-1 rounded-full border px-3 text-[12px] font-medium"
                            style={{
                                borderColor: "#ffd6d6",
                                background: "#fff5f5",
                                color: "#ff6b6b",
                            }}
                        >
                            <Clock3 size={14} strokeWidth={2} />
                            <span>{formatTimeLeft(item.meta?.timeLeft)}</span>
                        </span>
                    ) : null}

                    <span
                        className="inline-flex min-h-[25px] items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-medium"
                        style={{
                            borderColor: "#c7d7ff",
                            background: "#f5f8ff",
                            color: "#5b7cff",
                        }}
                    >
                        <Truck size={14} strokeWidth={2} />
                        <span>{formatPickupText(item.meta?.pickup)}</span>
                    </span>
                </div>
            </Link>

            <div className="mt-5 space-y-2">
                {options.map((option) => {
                    const optionKey = buildOptionKey(item.id, option.id);
                    const qty = qtyMap[optionKey] ?? 0;
                    const price = Number(option.price ?? item.price ?? 0);
                    const soldout = !!option.soldout;
                    const stockText = option.stockNote?.trim();

                    return (
                        <div
                            key={optionKey}
                            className={`flex items-center justify-between gap-3 rounded-2xl border bg-white p-4 transition-shadow shadow-sm`}
                            style={{
                                borderColor: "#e5e7eb",

                                opacity: soldout ? 0.60 : 1,
                            }}
                        >
                            <div className="min-w-0 flex-1">
                                <span
                                    className="inline-flex items-center gap-1 text-xs"
                                    style={{ color: "#ff6b6b" }}
                                >
                                    <span>{stockText ? "🔥" : "🚨"}</span>
                                    <span>{stockText || "전점 한정! 조기 마감될 수 있습니다."}</span>
                                </span>

                                <div className="mt-1 font-medium text-neutral-900">
                                    {option.name}
                                </div>

                                <div className="mt-1 text-sm text-neutral-600">
                                    {price.toLocaleString()}원
                                </div>
                            </div>

                            {soldout ? (
                                <div className="flex h-10 min-w-[68px] items-center justify-center rounded-xl bg-[#f3f4f6] px-4 text-sm font-bold text-[#9ca3af]">
                                    품절
                                </div>
                            ) : (
                                <QtyControl
                                    value={qty}
                                    disabled={!!item.isMockPreview}
                                    onMinus={() => onMinus(optionKey)}
                                    onPlus={() => onPlus(optionKey)}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </article>
    );
}

/**
 * 진행 중인 공구 전체 섹션
 */
export default function OngoingGroupBuySection({
    title = "🔥 진행 중인 공구",
    items,
    showOrderBar = true,
}: {
    title?: string;
    items: OngoingGroupBuyItem[];
    showOrderBar?: boolean;
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



    const displayItems = useMemo(() => {
        return [...items];
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

    /**
     * 금액 계산은 화면에 보이는 아이템 기준
     */
    const optionPriceMap = useMemo(() => {
        const map: Record<string, number> = {};

        for (const item of displayItems ?? []) {
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
    }, [displayItems]);

    /**
     * 실제 주문 가능한 선택만 집계
     * - preview 선택은 주문 활성화에 포함하지 않음
     */
    const realSelectedEntries = useMemo(() => {
        return Object.entries(qtyMap).filter(
            ([optionKey, qty]) => Number(qty) > 0 && optionMetaMap.has(optionKey)
        );
    }, [qtyMap, optionMetaMap]);

    const totalQty = realSelectedEntries.reduce((sum, [, qty]) => sum + qty, 0);

    const totalPrice = realSelectedEntries.reduce((sum, [optionKey, qty]) => {
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

        const selectedItems = realSelectedEntries
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

    return (
        <>
            <section className="mt-6 pb-0">
                <div className="text-xl font-bold text-neutral-1" style={{ color: "#222222" }}>
                    {title}
                </div>

                <div className="pb-0">
                    {displayItems.map((item, index) => (
                        <div key={item.id}>
                            <GroupBuyItemBlock
                                item={item}
                                qtyMap={qtyMap}
                                onMinus={minus}
                                onPlus={plus}
                            />

                            {index !== displayItems.length - 1 && (
                                <div className="w-full border-t" style={{ borderColor: "#d9d9d9" }} />
                            )}
                        </div>
                    ))}
                </div>

                {showOrderBar ? (
                    <div className="fixed bottom-0 inset-x-0 z-30 px-3">
                        <div className="mx-auto w-full max-w-[520px] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
                            <button
                                type="button"
                                onClick={submitQuickOrder}
                                disabled={!isActive || submitting}
                                className="relative h-12 w-full rounded-[12px] text-white font-bold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed"
                                style={{
                                    background: isActive
                                        ? "linear-gradient(180deg, #f6a45d 0%, #f07f22 0%)"
                                        : "#ffb224",
                                    boxShadow: isActive
                                        ? "0 10px 22px rgba(240,127,34,0.35)"
                                        : "none",
                                    opacity: isActive ? 1 : 0.5,
                                }}
                            >
                                <div className="relative flex w-full items-center justify-center">
                                    <span className="inline-flex items-center gap-2">
                                        <ShoppingBag size={18} />
                                        {submitting ? "주문 처리 중..." : "주문하기"}
                                    </span>

                                    {isActive ? (
                                        <span className="absolute right-4 inset-y-0 flex flex-col items-end justify-center text-right">
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
                ) : null}
            </section>

            <SuccessToast
                open={toastOpen}
                message="주문이 완료되었어요"
                onClose={() => setToastOpen(false)}
            />
        </>
    );
}