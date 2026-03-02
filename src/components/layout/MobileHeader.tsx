// src/components/layout/MobileHeader.tsx
"use client";

import Link from "next/link";
import Image from "next/image";

const BRAND_NAME = "디스카운트 올데이";

// 원본 로고(314x103) 비율 기준: 314 / 103 ≈ 3.05
// 헤더 높이 56px(h-14) 안에서 적당히 크게 보이게 높이 32px로 설정
const LOGO_H = 40;               // 기존 32 → 40
const LOGO_W = Math.round(LOGO_H * 3.05);

export default function MobileHeader({
                                         title,
                                         tenant,
                                         onMenuAction,
                                         onCartAction,
                                         mode = "default",
                                     }: {
    title: string;
    tenant: string;
    onMenuAction: () => void;
    onCartAction: () => void;
    mode?: "default" | "order";
}) {
    const isOrder = mode === "order";

    return (
        <header className="sticky top-0 z-50 glass">
            <div className="mx-auto w-full max-w-[520px] px-4">
                <div className="flex h-14 items-center justify-between">
                    {/* 왼쪽: 기본=햄버거 / 주문서=뒤로가기 */}
                    <button
                        onClick={onMenuAction}
                        className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-[color:var(--brand-soft)]"
                        aria-label={isOrder ? "뒤로가기" : "메뉴"}
                        type="button"
                    >
            <span className="text-xl font-black text-[color:var(--brand)]">
              {isOrder ? "←" : "☰"}
            </span>
                    </button>

                    {/* 중앙: 기본=로고 | 주문서=텍스트 */}
                    <div className="flex flex-1 items-center justify-center">
                        {isOrder ? (
                            <div className="text-base font-extrabold tracking-tight text-[color:var(--brand)]">
                                {title}
                            </div>
                        ) : (
                            <Link
                                href={`/${tenant}/home`}
                                className="flex items-center justify-center rounded-full px-2 py-1 transition hover:bg-[color:var(--accent-soft)]"
                                aria-label="홈으로"
                            >
                                {/* ✅ fill 대신 width/height로 고정 렌더링 -> 깨짐/리샘플링 이슈 크게 감소 */}
                                <Image
                                    src="/logo.png"
                                    alt={BRAND_NAME}
                                    width={LOGO_W}
                                    height={LOGO_H}
                                    sizes={`${LOGO_W}px`}
                                    quality={100}
                                    priority
                                    className="h-auto w-auto object-contain"
                                />
                            </Link>
                        )}
                    </div>

                    {/* 오른쪽: 주문서에서는 장바구니 숨김 */}
                    <div className="flex items-center gap-2">
                        {!isOrder ? (
                            <button
                                onClick={onCartAction}
                                className="relative flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-[color:var(--brand-soft)]"
                                aria-label="장바구니"
                                type="button"
                            >
                                <span className="text-[18px] text-[color:var(--brand)]">🛒</span>
                            </button>
                        ) : (
                            <div className="h-10 w-10" />
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}