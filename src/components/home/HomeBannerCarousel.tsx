"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Slide = {
    id: string;
    href: string;
    tag?: string;
    title: string;
    sub: string;
    strongLeft?: string;  // 예: "90% OFF"
    strongRight?: string; // 예: "25,000원"
    bg?: string;          // tailwind gradient class
};

export default function HomeBannerCarousel({ tenant }: { tenant: string }) {
    const slides: Slide[] = useMemo(
        () => [
            {
                id: "s1",
                href: `/${tenant}/goods/p1`,
                tag: "자세히 보기",
                title: "여기주목! 할인받고 서해 바다가자!",
                sub: "OCEAN THE HILL",
                strongLeft: "90% OFF",
                strongRight: "25,000원",
                bg: "bg-gradient-to-r from-emerald-50 to-slate-50",
            },
            {
                id: "s2",
                href: `/${tenant}/goods/p2`,
                tag: "이벤트",
                title: "라이프 라운지 가입 시, 1만원 상당 혜택 증정",
                sub: "가입 후 이벤트 참여하고 혜택을 받아보세요.",
                strongLeft: "혜택",
                strongRight: "10,000원",
                bg: "bg-gradient-to-r from-slate-50 to-emerald-50",
            },
            {
                id: "s3",
                href: `/${tenant}/goods/p3`,
                tag: "공지",
                title: "바로픽업 상품 모아보기",
                sub: "빠르게 픽업 가능한 상품을 확인하세요.",
                strongLeft: "바로",
                strongRight: "픽업",
                bg: "bg-gradient-to-r from-emerald-50 to-white",
            },
        ],
        [tenant]
    );

    const [idx, setIdx] = useState(0);

    useEffect(() => {
        const t = setInterval(() => {
            setIdx((v) => (v + 1) % slides.length);
        }, 3500);
        return () => clearInterval(t);
    }, [slides.length]);

    const s = slides[idx];

    return (
        <div className="mt-2">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <Link href={s.href} className={`block ${s.bg ?? "bg-white"}`}>
                    <div className="px-4 py-4">
                        {/* top line: tag + tenant brand */}
                        <div className="flex items-start justify-between gap-3">
              <span className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                {s.tag ?? "자세히 보기"}
              </span>

                            <div className="text-right">
                                <div className="text-[11px] font-semibold text-slate-400">
                                    {tenant}
                                </div>
                                <div className="text-[11px] font-semibold text-slate-500">
                                    DAICLO
                                </div>
                            </div>
                        </div>

                        {/* copy */}
                        <div className="mt-2">
                            <div className="text-base font-extrabold text-slate-900 leading-snug">
                                {s.title}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">{s.sub}</div>
                        </div>

                        {/* price line */}
                        {(s.strongLeft || s.strongRight) && (
                            <div className="mt-2 flex items-center gap-2 text-sm">
                                {s.strongLeft ? (
                                    <span className="font-extrabold text-emerald-700">
                    {s.strongLeft}
                  </span>
                                ) : null}
                                <span className="text-slate-300">|</span>
                                {s.strongRight ? (
                                    <span className="font-extrabold text-slate-900">
                    {s.strongRight}
                  </span>
                                ) : null}
                            </div>
                        )}
                    </div>
                </Link>

                {/* dots */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setIdx(i)}
                            aria-label={`slide ${i + 1}`}
                            className={`h-2 w-2 rounded-full ${
                                i === idx ? "bg-slate-900" : "bg-slate-300"
                            }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}