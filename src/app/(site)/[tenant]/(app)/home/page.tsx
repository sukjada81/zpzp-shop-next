// src/app/(site)/[tenant]/(app)/home/page.tsx
import Link from "next/link";
import HomeBannerCarousel from "@/components/home/HomeBannerCarousel";
import HomeCategoryIcons from "@/components/home/HomeCategoryIcons";

type CardItem = {
    id: string;
    title: string;
    price: number;
    subtitle?: string;
    tags?: string[]; // 예: ["3개 남았습니다!", "픽업 02/27"]
};

type GridSection = {
    title: string;
    href: string;
    items: CardItem[];
};

export default function HomePage({
                                     params,
                                 }: {
    params: { tenant: string };
}) {
    const { tenant } = params;

    const todaySection: GridSection = {
        title: "오늘의 공구",
        href: `/${tenant}/goods`,
        items: [
            {
                id: "g1",
                title: "[바로픽업가능] 수미감자스프(170G)/초당옥수수스프(160G)",
                price: 3300,
                tags: ["바로 픽업 가능", "주문 후 매장에서 바로 수령"],
            },
            {
                id: "g2",
                title: "[2/21] 대구 막창(500G)",
                price: 7900,
                tags: ["3개 남았습니다!", "픽업: 02/27 ~ 02/28"],
            },
        ],
    };

    const pickupSection: GridSection = {
        title: "바로 픽업 가능",
        href: `/${tenant}/goods`,
        items: [
            {
                id: "g3",
                title: "[바로픽업가능] 사르르콩 3종(자초/딸기/바나나)",
                price: 1900,
                tags: ["오늘 수령", "매장 픽업"],
            },
            {
                id: "g4",
                title: "[바로픽업가능] 제주팸비 제주흑돼지 육포 3종",
                price: 3900,
                tags: ["오늘 수령", "매장 픽업"],
            },
        ],
    };

    const ongoingSection: GridSection = {
        title: "진행 중인 공구",
        href: `/${tenant}/goods`,
        items: [
            {
                id: "g5",
                title: "[위클리공구] NEW 테팔 매직핸즈 세레니티 유칼립투스 6종 세트",
                price: 139000,
                tags: ["3시간 남음", "공구 마감 후 3영업일 이내 수령"],
            },
            {
                id: "g6",
                title: "[2/21] 프리미엄 간편식 모음",
                price: 12900,
                tags: ["11시간 남음", "픽업: 02/27"],
            },
        ],
    };

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24">
            {/* ✅ 배너/아이콘은 유지 */}
            <HomeBannerCarousel tenant={tenant} />
            <HomeCategoryIcons tenant={tenant} />

            {/* ✅ 오늘의 공구 (2열 카드) */}
            <SectionTitle title={todaySection.title} href={todaySection.href} />
            <Grid2 tenant={tenant} items={todaySection.items} />

            {/* ✅ 바로 픽업 가능 */}
            <SectionTitle title={pickupSection.title} href={pickupSection.href} />
            <Grid2 tenant={tenant} items={pickupSection.items} />

            {/* ✅ 진행 중인 공구 */}
            <SectionTitle title={ongoingSection.title} href={ongoingSection.href} />
            <Grid2 tenant={tenant} items={ongoingSection.items} />

            {/* ✅ 큰 프로모 카드(스크린샷 느낌) */}
            <section className="mt-6">
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                    <div className="h-[230px] bg-gradient-to-br from-emerald-500 to-teal-400 relative">
                        <div className="absolute inset-0 p-5 text-white">
                            <div className="text-[24px] font-extrabold leading-tight">
                                카니발
                                <br />
                                하이브리드
                                <br />
                                20대 한정
                            </div>
                            <div className="mt-3 text-sm font-bold opacity-95">초기비용 0원!</div>

                            <div className="absolute bottom-4 left-4 right-4">
                                <div className="rounded-2xl bg-white/90 p-3 text-slate-900">
                                    <div className="text-xs font-bold">[JAG] 신차 장기렌트 및 리스 문의</div>
                                    <div className="mt-1 text-[11px] text-slate-600">
                                        상담 신청 후 안내드립니다.
                                    </div>
                                    <button
                                        type="button"
                                        className="mt-3 w-full rounded-xl bg-slate-900 py-3 text-sm font-extrabold text-white active:scale-[0.99]"
                                    >
                                        상담 신청하기
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ✅ 하단 고정 주문하기 바 (스크린샷 느낌) */}
            {/*<div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-white/95 backdrop-blur">*/}
            {/*    <div className="mx-auto max-w-[520px] px-4 py-3">*/}
            {/*        <Link*/}
            {/*            href={`/${tenant}/order/new`}*/}
            {/*            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-extrabold text-white shadow-sm active:scale-[0.99]"*/}
            {/*        >*/}
            {/*            <span aria-hidden>🛒</span>*/}
            {/*            주문하기*/}
            {/*        </Link>*/}
            {/*    </div>*/}
            {/*</div>*/}
        </main>
    );
}

function SectionTitle({ title, href }: { title: string; href: string }) {
    return (
        <section className="mt-6">
            <div className="flex items-center justify-between">
                <div className="text-base font-extrabold text-slate-900">{title}</div>
                <Link href={href} className="text-xs font-bold text-slate-500 hover:text-slate-700">
                    더보기 &gt;
                </Link>
            </div>
        </section>
    );
}

function Grid2({ tenant, items }: { tenant: string; items: CardItem[] }) {
    return (
        <section className="mt-3 grid grid-cols-2 gap-3">
            {items.map((it) => (
                <Link
                    key={it.id}
                    href={`/${tenant}/goods/${it.id}`}
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden active:scale-[0.995]"
                >
                    {/* 썸네일 */}
                    <div className="aspect-[4/3] bg-slate-100">
                        <div className="h-full w-full bg-gradient-to-br from-slate-100 to-slate-200" />
                    </div>

                    <div className="p-3">
                        <div className="line-clamp-2 text-[13px] font-extrabold text-slate-900">
                            {it.title}
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                            <div className="text-[15px] font-extrabold tabular-nums text-slate-900">
                                {it.price.toLocaleString()}원
                            </div>
                        </div>

                        {/* 태그/메타 */}
                        {it.tags?.length ? (
                            <div className="mt-2 space-y-1">
                                {it.tags.slice(0, 2).map((t) => (
                                    <div
                                        key={t}
                                        className="inline-flex max-w-full items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600"
                                    >
                                        <span className="truncate">{t}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        <div className="mt-3">
                            <div className="w-full rounded-xl border border-slate-200 bg-white py-2 text-center text-[12px] font-extrabold text-slate-700">
                                자세히 보기
                            </div>
                        </div>
                    </div>
                </Link>
            ))}
        </section>
    );
}