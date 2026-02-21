"use client";

import Link from "next/link";

export default function MobileHeader({
                                         title,
                                         tenant,
                                         onMenuAction,
                                         onCartAction,
                                     }: {
    title: string;
    tenant: string;
    onMenuAction: () => void;
    onCartAction: () => void;
}) {
    return (
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
            <div className="mx-auto w-full max-w-[520px] px-4">
                <div className="h-14 flex items-center justify-between">

                    {/* 왼쪽 햄버거 */}
                    <button
                        onClick={onMenuAction}
                        className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition"
                        aria-label="메뉴"
                    >
                        <span className="text-xl">☰</span>
                    </button>

                    {/* 중앙 타이틀 */}
                    <div className="flex-1 text-center">
                        <Link
                            href={`/${tenant}/home`}
                            className="text-base font-extrabold tracking-tight text-slate-900"
                        >
                            {title}
                        </Link>
                    </div>

                    {/* 오른쪽 아이콘 */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onCartAction}
                            className="relative h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition"
                            aria-label="장바구니"
                        >
                            🛒
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}