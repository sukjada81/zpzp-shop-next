// src/components/home/HomeBannerCarousel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Slide = {
    id: string;
    href: string;
    imageUrl: string;
    alt: string;
    targetBlank?: boolean;
    rel?: string;
    type?: string;
    franchise?: string;
};

export default function HomeBannerCarousel({ tenant }: { tenant: string }) {
    const slides: Slide[] = useMemo(
        () => [
            {
                id: "14",
                href: `/api/track-click?type=banner&id=14&redirect=${encodeURIComponent(
                    "https://m.nsmall.com/store/exhibition/31139"
                )}&franchise=${tenant}`,
                imageUrl:
                    "https://daiclo-admin.s3.ap-northeast-2.amazonaws.com/banners/1773056800961.jpg",
                alt: "배너 1",
                targetBlank: true,
                rel: "noopener noreferrer",
                type: "banner",
                franchise: tenant,
            },
            {
                id: "15",
                href: `/api/track-click?type=banner&id=15&redirect=${encodeURIComponent(
                    "https://example.com/event/15"
                )}&franchise=${tenant}`,
                imageUrl: "https://dummyimage.com/1200x300/f3f4f6/111827&text=Banner+2",
                alt: "배너 2",
                targetBlank: true,
                rel: "noopener noreferrer",
                type: "banner",
                franchise: tenant,
            },
            {
                id: "16",
                href: `/api/track-click?type=banner&id=16&redirect=${encodeURIComponent(
                    "https://example.com/event/16"
                )}&franchise=${tenant}`,
                imageUrl: "https://dummyimage.com/1200x300/e5e7eb/111827&text=Banner+3",
                alt: "배너 3",
                targetBlank: true,
                rel: "noopener noreferrer",
                type: "banner",
                franchise: tenant,
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
            <div className="relative w-full overflow-hidden rounded-2xl border border-neutral-200 shadow-lg bg-white">
                <div className="relative w-full aspect-[4/1]">
                    <div
                        className="absolute inset-0 cursor-grab active:cursor-grabbing"
                        draggable={false}
                        style={{
                            userSelect: "none",
                            touchAction: "pan-y",
                        }}
                    >
                        {current.targetBlank ? (
                            <a
                                href={current.href}
                                target="_blank"
                                rel={current.rel ?? "noopener noreferrer"}
                                className="block w-full h-full"
                            >
                                <div className="relative w-full h-full bg-neutral-100 flex items-center justify-center">
                                    <img
                                        src={current.imageUrl}
                                        alt={current.alt}
                                        className="w-full h-full object-cover"
                                        draggable={false}
                                    />
                                </div>
                            </a>
                        ) : (
                            <Link href={current.href} className="block w-full h-full">
                                <div className="relative w-full h-full bg-neutral-100 flex items-center justify-center">
                                    <img
                                        src={current.imageUrl}
                                        alt={current.alt}
                                        className="w-full h-full object-cover"
                                        draggable={false}
                                    />
                                </div>
                            </Link>
                        )}
                    </div>

                    {slides.length > 1 && (
                        <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-2">
                            {slides.map((slide, i) => (
                                <button
                                    key={slide.id}
                                    type="button"
                                    onClick={() => setIdx(i)}
                                    aria-label={`${slide.alt} 이동`}
                                    className={`h-2 w-2 rounded-full transition ${i === idx ? "bg-white shadow" : "bg-white/50"
                                        }`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}