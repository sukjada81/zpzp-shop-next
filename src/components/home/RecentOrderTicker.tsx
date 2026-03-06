"use client";

import { useEffect, useMemo, useState } from "react";

export type RecentOrderTickerItem = {
    id: string;
    maskedName: string;
    minutesAgo: number;
    qty: number;
};

function formatAgo(minutesAgo: number) {
    if (minutesAgo <= 0) return "방금 전";
    if (minutesAgo < 60) return `${minutesAgo}분 전`;

    const hours = Math.floor(minutesAgo / 60);
    if (hours < 24) return `${hours}시간 전`;

    const days = Math.floor(hours / 24);
    return `${days}일 전`;
}

export default function RecentOrderTicker({
                                              items,
                                              rotateMs = 5000,
                                          }: {
    items: RecentOrderTickerItem[];
    rotateMs?: number;
}) {
    const visibleItems = useMemo(() => (items ?? []).filter(Boolean), [items]);
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (visibleItems.length <= 1) return;

        const timer = window.setInterval(() => {
            setIndex((prev) => (prev + 1) % visibleItems.length);
        }, rotateMs);

        return () => window.clearInterval(timer);
    }, [visibleItems.length, rotateMs]);

    useEffect(() => {
        setIndex(0);
    }, [visibleItems.length]);

    if (!visibleItems.length) return null;

    const current = visibleItems[index];

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