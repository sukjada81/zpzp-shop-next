// src/components/home/HomeCategoryIcons.tsx
"use client";

import Link from "next/link";
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
    href: string;
};

export default function HomeCategoryIcons({ tenant }: { tenant: string }) {
    const items: IconItem[] = [
        { key: "flower", label: "꽃다발", icon: Flower2, href: `/${tenant}/goods?cat=flower` },
        { key: "water", label: "정수기", icon: Droplets, href: `/${tenant}/goods?cat=water` },
        { key: "internet", label: "인터넷", icon: Wifi, href: `/${tenant}/goods?cat=internet` },
        { key: "wreath", label: "화환", icon: CircleDot, href: `/${tenant}/goods?cat=wreath` },
        { key: "move", label: "이사", icon: Truck, href: `/${tenant}/goods?cat=move` },
        { key: "phone", label: "핸드폰", icon: Smartphone, href: `/${tenant}/goods?cat=phone` },
        { key: "travel", label: "여행", icon: Luggage, href: `/${tenant}/goods?cat=travel` },
    ];

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const moveRef = useRef<HTMLAnchorElement | null>(null);

    useEffect(() => {
        const centerMoveItem = () => {
            const container = scrollRef.current;
            const target = moveRef.current;

            if (!container || !target) return;

            const containerWidth = container.clientWidth;
            const targetLeft = target.offsetLeft;
            const targetWidth = target.clientWidth;

            const nextScrollLeft = targetLeft - (containerWidth / 2) + (targetWidth / 2);

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

    return (
        <div className="mt-3">
            <div className="px-4 py-3 bg-white">
                <div
                    ref={scrollRef}
                    className="hide-scrollbar overflow-x-auto overflow-y-hidden overscroll-x-contain bg-white"
                >
                    <div className="flex w-max items-start gap-2">
                        {items.map((it) => {
                            const Icon = it.icon;
                            const isMove = it.key === "move";

                            return (
                                <Link
                                    key={it.key}
                                    ref={isMove ? moveRef : undefined}
                                    href={it.href}
                                    className="flex w-[64px] shrink-0 flex-col items-center"
                                >
                                    <div
                                        className="flex h-14 w-14 items-center justify-center rounded-full"
                                        style={{
                                            background: "#ffffff",
                                            border: "2px solid #ecebe9",
                                        }}
                                    >
                                        <Icon
                                            size={30}
                                            strokeWidth={2.3}
                                            color="#F08A2A"
                                        />
                                    </div>

                                    <div className="mt-1 text-center text-[13px] font-semibold leading-tight text-[color:var(--muted)]">
                                        {it.label}
                                    </div>
                                </Link>
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