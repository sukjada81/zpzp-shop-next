"use client";

import Link from "next/link";

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
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
            <div className="mx-auto w-full max-w-[520px] px-4">
                <div className="h-14 flex items-center justify-between">
                    {/* 왼쪽: 기본=햄버거 / 주문서=뒤로가기 */}
                    <button
                        onClick={onMenuAction}
                        className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition"
                        aria-label={isOrder ? "뒤로가기" : "메뉴"}
                    >
                        <span className="text-xl">{isOrder ? "←" : "☰"}</span>
                    </button>

                    {/* 중앙 타이틀: 주문서=링크 없이 텍스트만 */}
                    <div className="flex-1 text-center">
                        {isOrder ? (
                            <div className="text-base font-extrabold tracking-tight text-slate-900">
                                {title}
                            </div>
                        ) : (
                            <Link
                                href={`/${tenant}/home`}
                                className="text-base font-extrabold tracking-tight text-slate-900"
                            >
                                {title}
                            </Link>
                        )}
                    </div>

                    {/* 오른쪽: 주문서에서는 장바구니 숨김 */}
                    <div className="flex items-center gap-2">
                        {!isOrder ? (
                            <button
                                onClick={onCartAction}
                                className="relative h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition"
                                aria-label="장바구니"
                            >
                                🛒
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