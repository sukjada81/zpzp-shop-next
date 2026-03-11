// src/components/layout/MobileHeader.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";

const BRAND_NAME = "디스카운트 올데이";

// 로고 비율 유지
const LOGO_H = 24;
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
        <header className="sticky top-0 z-40 w-full border-b border-neutral-6 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/65">
            <div className="mx-auto w-full max-w-[520px] flex items-center justify-between h-[56px] px-[16px]">

                {/* LEFT */}
                <div className="w-[100px] flex items-center justify-start">
                    <button
                        onClick={onMenuAction}
                        aria-label={isOrder ? "뒤로가기" : "메뉴 열기"}
                        className="p-2 rounded-lg active:scale-95"
                        type="button"
                    >
                        {isOrder ? (
                            <span className="text-xl font-bold">←</span>
                        ) : (
                            <Menu size={22} />
                        )}
                    </button>
                </div>

                {/* CENTER */}
                <div className="min-w-0 text-center flex-1">
                    {isOrder ? (
                        <div className="text-base font-semibold truncate tracking-tight">
                            {title}
                        </div>
                    ) : (
                        <div className="text-base font-semibold truncate tracking-tight">
                            {title}
                        </div>
                    )}
                </div>

                {/* RIGHT */}
                <div className="w-[100px] flex flex-col items-end justify-end leading-none gap-1">
                    {!isOrder ? (
                        <>
                            <Link href={`/${tenant}/home`}>
                                <Image
                                    src="/logo.png"
                                    alt={BRAND_NAME}
                                    width={LOGO_W}
                                    height={LOGO_H}
                                    priority
                                />
                            </Link>

                            <div className="mt-0.5 truncate text-[10px] text-neutral-400">
                                용산해링턴스퀘어점
                            </div>
                        </>
                    ) : (
                        <button
                            onClick={onCartAction}
                            className="p-2 rounded-lg active:scale-95"
                            aria-label="장바구니"
                        >
                            🛒
                        </button>
                    )}
                </div>

            </div>
        </header>
    );
}