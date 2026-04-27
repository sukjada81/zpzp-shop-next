"use client";

// src/components/home/RecentOrderTicker.tsx

import { useEffect, useState } from "react";

export type RecentOrderTickerItem = {
    id: string;
    maskedName: string;
    minutesAgo: number;
    qty: number;
};

const FAKE_NAMES = [
    "김**수", "이**정", "박**준", "최**원", "정**현",
    "강**서", "윤**린", "임**우", "한**수", "오**영",
    "신**원", "권**연", "문**준", "허**민", "백**현",
    "유**진", "서**은", "조**성", "황**진", "류**아",
    "안**혁", "변**훈", "노**아", "홍**리", "손**하",
    "장**준", "전**환", "고**석", "나**진", "방**수",
];

const TARGET_COUNT = 30;

function formatAgo(minutesAgo: number) {
    if (minutesAgo <= 0) return "방금 전";
    if (minutesAgo < 60) return `${minutesAgo}분 전`;
    const hours = Math.floor(minutesAgo / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function generateFakeItems(count: number): RecentOrderTickerItem[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `fake-${i}-${Date.now()}`,
        maskedName: FAKE_NAMES[i % FAKE_NAMES.length],
        minutesAgo: Math.floor(Math.random() * 70) + 1,
        qty: Math.floor(Math.random() * 4) + 1,
    }));
}

export default function RecentOrderTicker({
    items,
    rotateMs = 4000,
}: {
    items: RecentOrderTickerItem[];
    rotateMs?: number;
}) {
    const [displayItems, setDisplayItems] = useState<RecentOrderTickerItem[]>([]);
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const realItems = (items ?? []).filter(Boolean).map((item) => ({
            ...item,
            minutesAgo: Math.min(Math.max(item.minutesAgo, 1), 70),
        }));

        const fakeCount = Math.max(0, TARGET_COUNT - realItems.length);
        const merged = shuffle([...realItems, ...generateFakeItems(fakeCount)]);

        setDisplayItems(merged);
        setIndex(Math.floor(Math.random() * Math.max(merged.length, 1)));
    }, []);

    useEffect(() => {
        if (displayItems.length <= 1) return;
        const timer = window.setInterval(() => {
            setIndex((prev) => (prev + 1) % displayItems.length);
        }, rotateMs);
        return () => window.clearInterval(timer);
    }, [displayItems.length, rotateMs]);

    if (!displayItems.length) return null;

    const current = displayItems[index] ?? displayItems[0];
    if (!current) return null;

    return (
        <section className="mt-3">
            <div className="rounded-2xl border border-[#b7d8bc] bg-[#f4fbf5] px-3 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[#7eb889] bg-white text-[12px]">
                            ✅
                        </span>

                        <div className="min-w-0 text-[14px] font-bold text-[#3c5c42]">
                            <span className="truncate">
                                <span className="font-extrabold">{current.maskedName}</span> 님이{" "}
                                <span className="text-[#3aa25a]">{formatAgo(current.minutesAgo)}</span>{" "}
                                <span className="text-[#3aa25a]">{current.qty}개</span>를 주문했어요
                            </span>
                        </div>
                    </div>

                    <span className="shrink-0 text-[14px] text-[#ef7f3b]">📈</span>
                </div>
            </div>
        </section>
    );
}
