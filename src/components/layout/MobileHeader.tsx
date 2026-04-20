"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";

const BRAND_NAME = "디스카운트 올데이";

const LOGO_H = 32;
const LOGO_W = Math.round(LOGO_H * 3.05);
const SIDE_W = 108;

export default function MobileHeader({
                                         title,
                                         tenant,
                                         storeName = "",
                                         onMenuAction,
                                         onCartAction,
                                         mode = "default",
                                     }: {
    title: string;
    tenant: string;
    storeName?: string;
    onMenuAction: () => void;
    onCartAction: () => void;
    mode?: "default" | "order" | "back";
}) {
    const isOrder = mode === "order";
    const isBack = mode === "back";
    const showBackButton = isOrder || isBack;

    return (
        <header className="sticky top-0 z-40 w-full bg-white/92 backdrop-blur supports-[backdrop-filter]:bg-white/75">
            <div className="mx-auto w-full max-w-[520px] px-4">
                <div className="flex h-[68px] items-center">
                    <div
                        className="flex shrink-0 items-center justify-start"
                        style={{ width: `${SIDE_W}px` }}
                    >
                        <button
                            onClick={onMenuAction}
                            aria-label={showBackButton ? "뒤로가기" : "메뉴 열기"}
                            className="grid h-10 w-10 place-items-center rounded-xl text-slate-800 transition active:scale-95"
                            type="button"
                        >
                            {showBackButton ? (
                                <span className="text-[24px] font-bold leading-none">←</span>
                            ) : (
                                <Menu size={24} strokeWidth={2.2} />
                            )}
                        </button>
                    </div>

                    <div className="min-w-0 flex-1 px-2 text-center">
                        <div className="truncate text-[18px] font-extrabold tracking-[-0.03em] text-slate-900">
                            {title}
                        </div>
                    </div>

                    <div
                        className="flex shrink-0 items-center justify-end"
                        style={{ width: `${SIDE_W}px` }}
                    >
                        {!isOrder ? (
                            <div className="flex flex-col items-end justify-center leading-none">
                                <Link
                                    href={`/${tenant}/home`}
                                    className="inline-flex items-center"
                                    aria-label={BRAND_NAME}
                                >
                                    <Image
                                        src="/logo.png"
                                        alt={BRAND_NAME}
                                        width={LOGO_W}
                                        height={LOGO_H}
                                        priority
                                    />
                                </Link>

                                <div className="mt-1 max-w-[108px] truncate text-[10px] font-medium tracking-[-0.01em] text-neutral-400">
                                    {storeName || ""}
                                </div>
                            </div>
                        ) : (
                            <div style={{ width: `${LOGO_W}px`, height: `${LOGO_H + 14}px` }} />
                        )}
                    </div>
                </div>

                <div className="border-b border-neutral-200/90" />
            </div>
        </header>
    );
}