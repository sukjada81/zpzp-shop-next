// src/components/home/HomeBannerCarousel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Slide = {
    id: string;
    href: string;
    tag?: string;
    title: string;
    sub: string;
    strongLeft?: string;
    strongRight?: string;
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
            },
            {
                id: "s2",
                href: `/${tenant}/goods/p2`,
                tag: "이벤트",
                title: "라이프 라운지 가입 시, 1만원 상당 혜택 증정",
                sub: "가입 후 이벤트 참여하고 혜택을 받아보세요.",
                strongLeft: "혜택",
                strongRight: "10,000원",
            },
            {
                id: "s3",
                href: `/${tenant}/goods/p3`,
                tag: "공지",
                title: "바로픽업 상품 모아보기",
                sub: "빠르게 픽업 가능한 상품을 확인하세요.",
                strongLeft: "바로",
                strongRight: "픽업",
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
            <div className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] shadow-sm bg-[color:var(--surface)]">
                {/* ✅ 브랜드 톤앤매너: 그라데이션 제거, 깔끔한 솔리드/소프트 배경 */}
                <Link
                    href={s.href}
                    className="block"
                    style={{
                        background: "var(--accent-soft)",
                    }}
                >
                    <div className="px-4 py-4">
                        {/* top line: tag only (tenant/DAICLO 제거) */}
                        <div className="flex items-start justify-between gap-3">
              <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold text-white"
                  style={{ background: "var(--accent)" }}
              >
                {s.tag ?? "자세히 보기"}
              </span>
                            {/* 오른쪽 정보 제거 */}
                            <div />
                        </div>

                        {/* copy */}
                        <div className="mt-2">
                            <div className="text-base font-extrabold text-[color:var(--fg)] leading-snug">
                                {s.title}
                            </div>
                            <div className="mt-1 text-xs text-[color:var(--muted)]">{s.sub}</div>
                        </div>

                        {/* price line */}
                        {(s.strongLeft || s.strongRight) && (
                            <div className="mt-2 flex items-center gap-2 text-sm">
                                {s.strongLeft ? (
                                    <span className="font-extrabold text-[color:var(--brand)]">{s.strongLeft}</span>
                                ) : null}
                                <span className="text-[color:var(--muted)]/40">|</span>
                                {s.strongRight ? (
                                    <span className="font-extrabold text-[color:var(--fg)]">{s.strongRight}</span>
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
                                i === idx ? "bg-[color:var(--brand)]" : "bg-[color:var(--muted)]/40"
                            }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}