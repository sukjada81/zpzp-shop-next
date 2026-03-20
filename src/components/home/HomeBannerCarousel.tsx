// src/components/home/HomeBannerCarousel.tsx
"use client";

export default function HomeBannerCarousel({ tenant }: { tenant: string }) {
    return (
        <div className="mb-2">
            <div className="relative w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg">
                <div className="relative flex w-full aspect-[4/1] items-center justify-center overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_28%)]" />

                    <div className="relative z-10 flex w-full items-center justify-between gap-4 text-white">
                        <div className="min-w-0">
                            <div className="mt-2 text-[20px] font-extrabold tracking-[-0.03em] md:text-[30px]">
                                배너 준비중
                            </div>
                            <div className="mt-1 text-[12px] font-medium text-white/80 md:text-[14px]">
                                곧 프로모션 배너가 노출될 예정입니다.
                            </div>
                        </div>

                        <div className="shrink-0 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-bold text-white/90 backdrop-blur md:px-5 md:py-2.5 md:text-[13px]">
                            Coming Soon
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}