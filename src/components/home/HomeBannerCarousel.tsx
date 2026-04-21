// src/components/home/HomeBannerCarousel.tsx
"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const banners = [
    { id: 1, image: "/banners/banner_0.jpg" },
    { id: 2, image: "/banners/banner_1.jpg" },
];

const SWIPE_THRESHOLD = 50;

export default function HomeBannerCarousel({ tenant }: { tenant: string }) {
    const [current, setCurrent] = useState(0);
    const [dragOffset, setDragOffset] = useState(0);
    const isDragging = useRef(false);
    const touchStartX = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 드래그 중에는 자동 슬라이드 일시 정지
    useEffect(() => {
        const interval = setInterval(() => {
            if (!isDragging.current) {
                setCurrent((prev) => (prev + 1) % banners.length);
            }
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    function handleTouchStart(e: React.TouchEvent) {
        touchStartX.current = e.touches[0].clientX;
        isDragging.current = true;
        setDragOffset(0);
    }

    function handleTouchMove(e: React.TouchEvent) {
        if (touchStartX.current === null) return;
        const diff = e.touches[0].clientX - touchStartX.current;
        // 첫 슬라이드에서 왼쪽, 마지막 슬라이드에서 오른쪽 방향은 저항감 추가
        const atStart = current === 0 && diff > 0;
        const atEnd = current === banners.length - 1 && diff < 0;
        setDragOffset(atStart || atEnd ? diff * 0.3 : diff);
    }

    function handleTouchEnd() {
        isDragging.current = false;
        if (touchStartX.current === null) return;

        if (dragOffset < -SWIPE_THRESHOLD) {
            setCurrent((prev) => Math.min(prev + 1, banners.length - 1));
        } else if (dragOffset > SWIPE_THRESHOLD) {
            setCurrent((prev) => Math.max(prev - 1, 0));
        }

        touchStartX.current = null;
        setDragOffset(0);
    }

    const containerWidth = containerRef.current?.offsetWidth ?? 0;
    const offsetPercent =
        containerWidth > 0 ? (dragOffset / containerWidth) * 100 : 0;
    const translateX = -(current * 100) + offsetPercent;

    return (
        <div className="mb-2">
            <div className="relative w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg">
                <div
                    ref={containerRef}
                    className="relative aspect-[4/1] w-full overflow-hidden"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                >
                    {/* 슬라이드 트랙 */}
                    <div
                        className="flex h-full"
                        style={{
                            width: `${banners.length * 100}%`,
                            transform: `translateX(${translateX / banners.length}%)`,
                            transition: dragOffset === 0 ? "transform 0.45s ease" : "none",
                        }}
                    >
                        {banners.map((banner, index) => (
                            <div
                                key={banner.id}
                                className="relative h-full"
                                style={{ width: `${100 / banners.length}%` }}
                            >
                                <Image
                                    src={banner.image}
                                    alt={`banner-${index}`}
                                    fill
                                    className="object-cover"
                                    priority={index === 0}
                                    draggable={false}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* 인디케이터 — 클릭으로도 이동 가능 */}
                <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
                    {banners.map((_, index) => (
                        <button
                            key={index}
                            type="button"
                            aria-label={`배너 ${index + 1}`}
                            onClick={() => setCurrent(index)}
                            className={`h-2 rounded-full transition-all duration-300 ${
                                current === index ? "w-5 bg-white" : "w-2 bg-white/45"
                            }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
