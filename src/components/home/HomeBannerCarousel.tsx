// src/components/home/HomeBannerCarousel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Slide = {
    id: string;
    href: string;
    imageUrl: string;
    alt: string;
    targetBlank?: boolean;
    rel?: string;
};

export default function HomeBannerCarousel({ tenant }: { tenant: string }) {
    const slides: Slide[] = useMemo(
        () => [
            {
                id: "11",
                href: `/api/track-click?type=banner&id=11&redirect=${encodeURIComponent(
                    "https://focusin.kr/surl/P/32"
                )}&franchise=${encodeURIComponent(tenant)}`,
                imageUrl:
                    "https://daiclo-admin.s3.ap-northeast-2.amazonaws.com/banners/1773309468789.png",
                alt: "배너 3",
                targetBlank: true,
                rel: "noopener noreferrer",
            },
            {
                id: "14",
                href: `/api/track-click?type=banner&id=14&redirect=${encodeURIComponent(
                    "https://m.nsmall.com/store/exhibition/31139"
                )}&franchise=${encodeURIComponent(tenant)}`,
                imageUrl:
                    "https://daiclo-admin.s3.ap-northeast-2.amazonaws.com/banners/1773056800961.jpg",
                alt: "배너 2",
                targetBlank: true,
                rel: "noopener noreferrer",
            },
            {
                id: "21",
                href: `/api/track-click?type=banner&id=21&redirect=${encodeURIComponent(
                    "https://m.site.naver.com/22bq0"
                )}&franchise=${encodeURIComponent(tenant)}`,
                imageUrl:
                    "https://daiclo-admin.s3.ap-northeast-2.amazonaws.com/banners/1772753560005.jpg",
                alt: "배너 1",
                targetBlank: true,
                rel: "noopener noreferrer",
            },
        ],
        [tenant]
    );

    const [idx, setIdx] = useState(0);

    useEffect(() => {
        if (slides.length <= 1) return;

        const t = setInterval(() => {
            setIdx((prev) => (prev + 1) % slides.length);
        }, 3500);

        return () => clearInterval(t);
    }, [slides.length]);

    const current = slides[idx];

    return (
        <div className="mb-2">
            <div className="relative w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg">
                <div className="relative w-full aspect-[4/1]">
                    <div
                        className="absolute inset-0 cursor-grab active:cursor-grabbing"
                        draggable={false}
                        style={{
                            userSelect: "none",
                            touchAction: "pan-y",
                        }}
                    >
                        <a
                            href={current.href}
                            target={current.targetBlank ? "_blank" : undefined}
                            rel={current.rel ?? "noopener noreferrer"}
                            className="block w-full h-full"
                        >
                            <div className="relative flex h-full w-full items-center justify-center bg-neutral-100">
                                <img
                                    src={current.imageUrl}
                                    alt={current.alt}
                                    className="h-full w-full object-cover"
                                    draggable={false}
                                />
                            </div>
                        </a>
                    </div>

                    {slides.length > 1 ? (
                        <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-2">
                            {slides.map((slide, i) => (
                                <button
                                    key={slide.id}
                                    type="button"
                                    onClick={() => setIdx(i)}
                                    aria-label={`${slide.alt} 이동`}
                                    className={`h-2 w-2 rounded-full transition ${
                                        i === idx ? "bg-white shadow" : "bg-white/50"
                                    }`}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}