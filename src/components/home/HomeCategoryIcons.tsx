// src/components/home/HomeCategoryIcons.tsx
"use client";

import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import {
    Flower2,
    Droplets,
    Wifi,
    CircleDot,
    Truck,
    Smartphone,
    Luggage,
} from "lucide-react";

type IconItem = {
    key: string;
    label: string;
    icon: LucideIcon;
};

export default function HomeCategoryIcons({ tenant }: { tenant: string }) {
    const items: IconItem[] = [
        { key: "flower", label: "꽃다발", icon: Flower2 },
        { key: "water", label: "정수기", icon: Droplets },
        { key: "internet", label: "인터넷", icon: Wifi },
        { key: "wreath", label: "화환", icon: CircleDot },
        { key: "move", label: "이사", icon: Truck },
        { key: "phone", label: "핸드폰", icon: Smartphone },
        { key: "travel", label: "여행", icon: Luggage },
    ];

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const moveRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        const centerMoveItem = () => {
            const container = scrollRef.current;
            const target = moveRef.current;

            if (!container || !target) return;

            const containerWidth = container.clientWidth;
            const targetLeft = target.offsetLeft;
            const targetWidth = target.clientWidth;

            const nextScrollLeft = targetLeft - containerWidth / 2 + targetWidth / 2;

            container.scrollTo({
                left: Math.max(0, nextScrollLeft),
                behavior: "auto",
            });
        };

        const raf = requestAnimationFrame(centerMoveItem);
        window.addEventListener("resize", centerMoveItem);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", centerMoveItem);
        };
    }, []);

    const handlePreparing = (label: string) => {
        window.alert(`${label} 서비스는 현재 준비중입니다.`);
    };

    return (
        <div className="mt-3">
            <div className="bg-white px-4 py-3">
                <div
                    ref={scrollRef}
                    className="hide-scrollbar overflow-x-auto overflow-y-hidden overscroll-x-contain bg-white"
                >
                    <div className="flex w-max items-start gap-2">
                        {items.map((it) => {
                            const Icon = it.icon;
                            const isMove = it.key === "move";

                            return (
                                <button
                                    key={it.key}
                                    ref={isMove ? moveRef : undefined}
                                    type="button"
                                    onClick={() => handlePreparing(it.label)}
                                    className="flex w-[64px] shrink-0 flex-col items-center"
                                >
                                    <div
                                        className="flex h-14 w-14 items-center justify-center rounded-full"
                                        style={{
                                            background: "#ffffff",
                                            border: "2px solid #ecebe9",
                                        }}
                                    >
                                        <Icon size={30} strokeWidth={2.3} color="#F08A2A" />
                                    </div>

                                    <div className="mt-1 text-center text-[13px] font-semibold leading-tight text-[color:var(--muted)]">
                                        {it.label}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
            <div className="mt-5 text-center text-sm text-[color:var(--muted)]">
                공구 클릭시 상세내용 확인 가능합니다.
            </div>
        </div>
    );
}