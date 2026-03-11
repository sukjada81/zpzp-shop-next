"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBag, TrendingUp, Clock3, Truck } from "lucide-react";

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
 */
type OptionItem = {
    id: string;
    name: string;
    price: number | null;
    soldout?: boolean;
    stockNote?: string;
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
    return timeLeft || "9시간 뒤 마감";
}

/**
 * 픽업 문구 기본값
 * - 일반 픽업일 안내
 * - "바로 픽업 가능 · 주문 후 매장에서 바로 수령" 같은 문구도 그대로 노출 가능
 */
function formatPickupText(pickup?: string) {
    return pickup || "픽업일: 03/16(월) ~ 03/17(화)";
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
            className={`w-full rounded-[12px] border px-3 py-2 transition-opacity duration-300 ${animateClass}`}
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
 * - 품절이 아니면 수량 증감 가능
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
 * - 이미지가 여러 장일 수 있음
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
 * - 상단 알림
 * - 썸네일 리스트
 * - 제목 / 배지
 * - 옵션 목록
 */
function GroupBuyItemBlock({
    item,
    qtyMap,
    onMinus,
    onPlus,
}: {
    item: OngoingGroupBuyItem;
    qtyMap: Record<string, number>;
    onMinus: (optionId: string) => void;
    onPlus: (optionId: string) => void;
}) {
    /**
     * 옵션이 없으면 상품 자체를 1개 옵션처럼 처리
     */
    const options = useMemo(() => {
        if (item.options?.length) return item.options;
        return [
            {
                id: `base_${item.id}`,
                name: item.title,
                price: item.price,
            },
        ];
    }, [item]);

    const mockNotices = useMemo(() => makeMockNotices(item.id), [item.id]);
    const [noticeIndex, setNoticeIndex] = useState(0);
    const [noticeVisible, setNoticeVisible] = useState(true);

    /**
     * 상단 주문 알림 자동 순환
     */
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
        <div className="py-4">
            {/* 상단 실시간 주문 알림 */}
            {!item.isMockPreview ? (
                <div className="mb-2">
                    <CompactNoticeBar
                        notice={currentNotice}
                        animateClass={noticeVisible ? "opacity-100" : "opacity-0"}
                    />
                </div>
            ) : null}

            {/* 상품 썸네일 */}
            <ProductThumbStrip images={item.images} />

            {/* 상품 제목 / 상태 배지 */}
            <Link href={item.href || "#"} className="mt-3 block">
                <div
                    className="mb-1 line-clamp-2 text-[17px] font-extrabold leading-[1.4] tracking-[-0.03em]"
                    style={{ color: "#222222" }}
                >
                    {item.title}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* 마감 배지 */}
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

                    {/* 픽업 안내 배지 */}
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

            {/* 옵션 카드 리스트 */}
            <div className="mt-5 space-y-2">
                {options.map((option) => {
                    const qty = qtyMap[option.id] ?? 0;
                    const price = Number(option.price ?? item.price ?? 0);
                    const soldout = !!option.soldout;
                    const stockText = option.stockNote?.trim();

                    return (
                        <div
                            key={option.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-4 transition-shadow"
                            style={{
                                borderColor: "#e5e7eb",
                                boxShadow: "none",
                                opacity: soldout ? 0.92 : 1,
                            }}
                        >
                            {/* 옵션 정보 */}
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

                            {/* 품절이면 품절 표시, 아니면 수량 버튼 노출 */}
                            {soldout ? (
                                <div className="flex h-10 min-w-[68px] items-center justify-center rounded-xl bg-[#f3f4f6] px-4 text-sm font-bold text-[#9ca3af]">
                                    품절
                                </div>
                            ) : (
                                <QtyControl
                                    value={qty}
                                    disabled={false}
                                    onMinus={() => onMinus(option.id)}
                                    onPlus={() => onPlus(option.id)}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * 진행 중인 공구 전체 섹션
 * - 여러 공구 블록 렌더링
 * - 하단 주문하기 바 렌더링
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

    const previewMockItem: OngoingGroupBuyItem = {
        id: "__mock_preview__",
        tenant: "preview",
        title: "[어포튀각 깡사기 3종(오리지널/핫/뿌링)]",
        price: 2500,
        images: [
            {
                key: "https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?q=80&w=1200&auto=format&fit=crop",
                label: "어포튀각 이미지 1",
            },
            {
                key: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?q=80&w=1200&auto=format&fit=crop",
                label: "어포튀각 이미지 2",
            },
            {
                key: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1200&auto=format&fit=crop",
                label: "어포튀각 이미지 3",
            },
        ],
        options: [
            {
                id: "__mock_opt_1",
                name: "어포튀각 깡사기 (오리지널)",
                price: 2500,
                soldout: true,
                stockNote: "한정수량 마감!",
            },
            {
                id: "__mock_opt_2",
                name: "어포튀각 깡사기 (핫)",
                price: 2500,
                soldout: false,
                stockNote: "5개 남았습니다!",
            },
            {
                id: "__mock_opt_3",
                name: "어포튀각 깡사기 (뿌링)",
                price: 2500,
                soldout: false,
                stockNote: "5개 남았습니다!",
            },
        ],
        meta: {
            pickup: "바로 픽업 가능 · 주문 후 매장에서 바로 수령",
        },
        isMockPreview: true,
    };

    const displayItems = useMemo(() => {
        return [...items, previewMockItem];
    }, [items]);

    /**
     * 옵션별 가격 맵
     * - 총 주문 금액 계산용
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
                        },
                    ];

            for (const option of options) {
                map[option.id] = Number(option.price ?? item.price ?? 0);
            }
        }

        return map;
    }, [displayItems]);

    /**
     * 총 수량
     */
    const totalQty = Object.values(qtyMap).reduce((sum, qty) => sum + qty, 0);

    /**
     * 총 금액
     */
    const totalPrice = Object.entries(qtyMap).reduce((sum, [optionId, qty]) => {
        return sum + (optionPriceMap[optionId] ?? 0) * qty;
    }, 0);

    /**
     * 1개 이상 선택 시 주문 버튼 활성화
     */
    const isActive = totalQty > 0;

    /**
     * 수량 감소
     */
    function minus(optionId: string) {
        setQtyMap((prev) => ({
            ...prev,
            [optionId]: Math.max(0, (prev[optionId] ?? 0) - 1),
        }));
    }

    /**
     * 수량 증가
     */
    function plus(optionId: string) {
        setQtyMap((prev) => ({
            ...prev,
            [optionId]: (prev[optionId] ?? 0) + 1,
        }));
    }

    return (
        <section className="mt-6 pb-0">
            {/* 섹션 타이틀 */}
            <div className="text-xl font-bold text-neutral-1" style={{ color: "#222222" }}>
                {title}
            </div>

            {/* 공구 목록 */}
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


            {/* 하단 주문 바 */}
            {showOrderBar ? (
                <div className="fixed bottom-0 inset-x-0 z-30 px-3">
                    <div className="mx-auto w-full max-w-[520px] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
                        <button
                            type="button"
                            disabled={!isActive}
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
                            {/* 가운데 주문 버튼 텍스트 */}
                            <div className="relative flex w-full items-center justify-center">
                                <span className="inline-flex items-center gap-2">
                                    <ShoppingBag size={18} />
                                    주문하기
                                </span>

                                {/* 오른쪽 총 수량 / 금액 */}
                                {isActive ? (
                                    <span className="absolute right-4 inset-y-0 flex flex-col items-end justify-center text-right">
                                        <span className="text-[13px] opacity-90">총 {totalQty}개</span>
                                    </span>
                                ) : null}
                            </div>
                        </button>
                    </div>
                </div>
            ) : null}
        </section>
    );
}