// src/components/layout/MobileHeader.tsx
"use client";

import Link from "next/link";
import Image from "next/image";

const BRAND_NAME = "디스카운트 올데이";

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
                <div className="h-14 flex items-center justify-between">
                    {/* 왼쪽: 기본=햄버거 / 주문서=뒤로가기 */}
                    <button
                        onClick={onMenuAction}
                        className="h-10 w-10 flex items-center justify-center rounded-full transition hover:bg-[color:var(--brand-soft)]"
                        aria-label={isOrder ? "뒤로가기" : "메뉴"}
                    >
            <span className="text-xl font-black text-[color:var(--brand)]">
              {isOrder ? "←" : "☰"}
            </span>
                    </button>

                    {/* 중앙: 기본=로고만(크게) | 주문서=텍스트 */}
                    <div className="flex-1 flex items-center justify-center">
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
                                {/* ✅ 로고 크기 업: 32 -> 44 */}
                                <span className="relative h-31 w-31">
                  <Image
                      src="/logo.png"
                      alt={BRAND_NAME}
                      fill
                      sizes="44px"
                      className="object-contain"
                      priority
                  />
                </span>
                            </Link>
                        )}
                    </div>

                    {/* 오른쪽: 주문서에서는 장바구니 숨김 */}
                    <div className="flex items-center gap-2">
                        {!isOrder ? (
                            <button
                                onClick={onCartAction}
                                className="relative h-10 w-10 flex items-center justify-center rounded-full transition hover:bg-[color:var(--brand-soft)]"
                                aria-label="장바구니"
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