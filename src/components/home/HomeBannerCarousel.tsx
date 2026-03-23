// src/components/home/HomeBannerCarousel.tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const banners = [
    {
        id: 1,
        image: "/banners/banner_0.jpg",
    },
    {
        id: 2,
        image: "/banners/banner_1.jpg",
    },
    {
        id: 3,
        image: "/banners/banner_2.jpg",
    },
];

export default function HomeBannerCarousel({ tenant }: { tenant: string }) {
    const [current, setCurrent] = useState(0);

    // 자동 슬라이드
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrent((prev) => (prev + 1) % banners.length);
        }, 4000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="mb-2">
            <div className="relative w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg">

                {/* 슬라이드 영역 */}
                <div className="relative w-full aspect-[4/1] overflow-hidden">
                    {banners.map((banner, index) => (
                        <div
                            key={banner.id}
                            className={`absolute inset-0 transition-opacity duration-700 ${
                                current === index ? "opacity-100 z-10" : "opacity-0 z-0"
                            }`}
                        >
                            <Image
                                src={banner.image}
                                alt={`banner-${index}`}
                                fill
                                className="object-cover"
                                priority={index === 0}
                            />
                        </div>
                    ))}
                </div>

                {/* 인디케이터 */}
                <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 gap-1">
                    {banners.map((_, index) => (
                        <div
                            key={index}
                            className={`h-2 w-2 rounded-full ${
                                current === index ? "bg-white" : "bg-white/40"
                            }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}