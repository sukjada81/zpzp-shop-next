// src/app/(site)/[tenant]/(app)/home/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Gift, Clock3, Sparkles } from "lucide-react";
import HomeBannerCarousel from "@/components/home/HomeBannerCarousel";
import HomeCategoryIcons from "@/components/home/HomeCategoryIcons";
import HomeProfileGate from "@/components/profile/HomeProfileGate";
import { endpoints } from "@/lib/api/endpoints";
import { normalizeTenant } from "@/lib/tenant/getTenant";
import type { PublicProductsResponse } from "@/lib/types/goods";

type CardItem = {
    id: string;
    title: string;
    price: number;
    tags?: string[];
    thumbnailUrl?: string;
    categoryLabel?: string;
    cate?: string | null;
};

type GridSection = {
    title: string;
    href: string;
    items: CardItem[];
    description?: string;
};

function getInternalOrigin() {
    return process.env.NEXT_INTERNAL_ORIGIN || process.env.NEXT_PUBLIC_BASE_URL || "http://127.0.0.1:3000";
}

async function fetchProducts(
    tenant: string,
    q?: {
        take?: number;
        q?: string;
        type?: "today" | "pickup" | "ongoing";
    }
) {
    const origin = getInternalOrigin();
    const path = endpoints.publicProducts(tenant, q);
    const url = new URL(path, origin);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [] as PublicProductsResponse["items"];

    const data = (await res.json().catch(() => null)) as PublicProductsResponse | null;
    if (!data?.ok) return [];

    return data.items ?? [];
}

function displayCategoryLabel(label?: string) {
    if (label === "오늘의 공구") return "오늘의 특가상품";
    return label;
}

function toCardItems(items: PublicProductsResponse["items"]): CardItem[] {
    return (items ?? []).map((p) => ({
        id: String(p.id ?? ""),
        title: String(p.title ?? ""),
        price: Number(p.price ?? 0),
        thumbnailUrl: p.thumbnailUrl,
        cate: p.cate ?? null,
        categoryLabel: displayCategoryLabel(p.categoryLabel),
        tags: [...(p.metaLeft ? [p.metaLeft] : []), ...(p.metaRight ? [p.metaRight] : [])].slice(0, 2),
    }));
}

function categoryBadgeColor(label?: string) {
    if (label === "오늘의 특가상품") return "bg-amber-500 text-white";
    if (label === "바로 픽업 가능") return "bg-sky-500 text-white";
    return "bg-slate-800 text-white";
}

export default async function HomePage({
                                           params,
                                       }: {
    params: { tenant: string } | Promise<{ tenant: string }>;
}) {
    const resolved = await Promise.resolve(params);
    const tenant = normalizeTenant(resolved?.tenant);

    if (!tenant) notFound();

    const todayProducts = await fetchProducts(tenant, { take: 8, type: "today" });
    const pickupProducts = await fetchProducts(tenant, { take: 8, type: "pickup" });

    const todaySection: GridSection = {
        title: "🛒 오늘의 특가상품",
        href: `/${tenant}/goods?tab=today`,
        items: toCardItems(todayProducts),
    };

    const pickupSection: GridSection = {
        title: "📦 바로 픽업 가능",
        href: `/${tenant}/goods?tab=pickup`,
        items: toCardItems(pickupProducts),
    };

    return (
        <main className="mx-auto w-full max-w-[520px] px-4 pb-24 pt-3">
            <HomeProfileGate tenant={tenant} />

            <HomeBannerCarousel tenant={tenant} />

            <div className="hidden">
                <HomeCategoryIcons tenant={tenant} />
            </div>

            <SectionTitle
                title={todaySection.title}
                href={todaySection.href}
                description={todaySection.description}
            />
            <Grid2 tenant={tenant} items={todaySection.items} emptyText="등록된 상품이 없습니다." />

            <SectionTitle
                title={pickupSection.title}
                href={pickupSection.href}
                description={pickupSection.description}
            />
            <Grid2 tenant={tenant} items={pickupSection.items} emptyText="등록된 상품이 없습니다." />

            <PreparingSection />

            <RecommendedBlock tenant={tenant} />
        </main>
    );
}

function PreparingSection() {
    return (
        <section className="mt-6">
            <div className="flex items-center justify-between">
                <div className="text-xl font-bold text-neutral-1">🔥 진행 중인 공구</div>
            </div>

            <div className="mt-3 overflow-hidden rounded-[24px] border border-[#f2d1a6] bg-white shadow-sm">
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#fff7ed] via-[#fffaf4] to-[#ffffff]" />
                    <div className="relative px-5 py-6">
                        <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#ffedd5] text-[#f97316] shadow-sm">
                                <Clock3 size={22} strokeWidth={2.2} />
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="inline-flex items-center gap-1 rounded-full border border-[#fed7aa] bg-[#fff7ed] px-2.5 py-1 text-[11px] font-extrabold text-[#ea580c]">
                                    <Sparkles size={12} strokeWidth={2.2} />
                                    COMING SOON
                                </div>

                                <div className="mt-3 text-[20px] font-extrabold tracking-[-0.02em] text-[#1f2937]">
                                    준비중입니다
                                </div>

                                <div className="mt-2 text-[14px] leading-[1.6] text-[#6b7280]">
                                    진행 중인 공구 상품은 현재 준비 중입니다.
                                    <br />
                                    더 좋은 구성으로 곧 업데이트될 예정입니다.
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-2">
                            <div className="rounded-2xl border border-[#fde7cf] bg-white/80 px-3 py-3">
                                <div className="text-[11px] font-bold text-[#f97316]">상태</div>
                                <div className="mt-1 text-[14px] font-extrabold text-[#111827]">업데이트 준비중</div>
                            </div>
                            <div className="rounded-2xl border border-[#fde7cf] bg-white/80 px-3 py-3">
                                <div className="text-[11px] font-bold text-[#f97316]">안내</div>
                                <div className="mt-1 text-[14px] font-extrabold text-[#111827]">곧 오픈 예정</div>
                            </div>
                        </div>

                        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-[#ffedd5]">
                            <div className="h-full w-[38%] rounded-full bg-gradient-to-r from-[#fb923c] to-[#f97316]" />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function SectionTitle({
                          title,
                          href,
                          description,
                      }: {
    title: string;
    href: string;
    description?: string;
}) {
    return (
        <section className="mt-4">
            <div className="flex items-center justify-between">
                <div className="text-xl font-bold text-neutral-1">{title}</div>
                <Link
                    href={href}
                    className="text-xs font-bold text-[color:var(--muted)] hover:opacity-80"
                >
                    더보기 &gt;
                </Link>
            </div>

            {description ? (
                <div className="mt-1 text-sm font-medium text-[color:var(--muted)]">{description}</div>
            ) : null}
        </section>
    );
}

function Grid2({
                   tenant,
                   items,
                   emptyText,
               }: {
    tenant: string;
    items: CardItem[];
    emptyText: string;
}) {
    if (!items.length) {
        return (
            <section className="mt-3">
                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm font-semibold text-[color:var(--muted)]">
                    {emptyText}
                </div>
            </section>
        );
    }

    return (
        <section className="mt-3 -mx-4 overflow-y-hidden px-4">
            <div
                className="hide-scrollbar flex gap-4 overflow-x-auto snap-x snap-mandatory overflow-y-hidden pb-2"
                style={{ scrollbarWidth: "none" }}
            >
                {items.map((it) => (
                    <div
                        key={it.id}
                        className="flex min-w-[260px] max-w-[260px] snap-start flex-col"
                    >
                        <div className="h-full">
                            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-[#ecebe9] bg-white cursor-pointer">
                                <Link href={`/${tenant}/goods/${it.id}`} className="flex h-full w-full items-center justify-center p-2">
                                    {it.thumbnailUrl ? (
                                        <img
                                            src={it.thumbnailUrl}
                                            alt={it.title}
                                            className="max-h-full max-w-full object-contain"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="h-full w-full bg-gradient-to-br from-white to-[color:var(--brand-soft)]" />
                                    )}
                                </Link>

                                {it.categoryLabel ? (
                                    <div className="absolute left-3 top-3">
                                        <span
                                            className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${categoryBadgeColor(
                                                it.categoryLabel
                                            )}`}
                                        >
                                            {it.categoryLabel}
                                        </span>
                                    </div>
                                ) : null}
                            </div>

                            <Link
                                href={`/${tenant}/goods/${it.id}`}
                                className="mt-3 block h-full flex flex-col"
                            >
                                <div className="mb-2 line-clamp-2 text-[17px] font-bold leading-snug tracking-tight text-[color:var(--fg)]">
                                    {it.title}
                                </div>
                            </Link>
                        </div>

                        <div className="mt-auto">
                            <Link
                                href={`/${tenant}/goods/${it.id}`}
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#ecebe9] bg-white shadow-sm transition-all duration-150 active:scale-[0.98]"
                            >
                                <span className="text-sm font-bold text-[color:var(--fg)]">자세히 보기</span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-[color:var(--muted)]"
                                    aria-hidden="true"
                                >
                                    <path d="m9 18 6-6-6-6"></path>
                                </svg>
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function RecommendedBlock({ tenant }: { tenant: string }) {
    const serviceCards = [
        {
            id: "svc-1",
            title: "바디프랜드 3월 최고의 혜택",
            desc: "신세계상품권 최대 30만원 + 다이클로 5만 포인트",
            image:
                "https://images.unsplash.com/photo-1584515933487-779824d29309?q=80&w=1200&auto=format&fit=crop",
            href: "https://m.nsmall.com/store/exhibition/31139",
        },
        {
            id: "svc-2",
            title: "제품 1개 가격! 데일리 기초 3종!",
            desc: "파격! 66프로 할인 => 46,000원!!",
            image:
                "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=1200&auto=format&fit=crop",
            href: "https://m.site.naver.com/22bq0",
        },
        {
            id: "svc-3",
            title: "SKY 합격생 추천 집중력 영양제",
            desc: "신학기 특가!! 71% OFF!!",
            image:
                "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=1200&auto=format&fit=crop",
            href: "https://focusin.kr/surl/P/32",
        },
        {
            id: "svc-4",
            title: "KIA 인기모델 6종 한정수량!!!",
            desc: "✔ K5/K7/K8/K9/카니발/타스만 최저가!",
            image:
                "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1200&auto=format&fit=crop",
            href: "https://forms.gle/3FfQV1C3f6PjaUiP6",
        },
    ];

    const suggestList = [
        {
            id: "ad-1",
            badge: "AD",
            brand: "집들이선물 & 개업화분",
            title: "감도높은 플랜테리어 식물을 가성비있게",
            desc: "11,900원~",
            cta: "구매하기",
            image:
                "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?q=80&w=1200&auto=format&fit=crop",
            href: "https://smartstore.naver.com/sinhotree/products/13233908416",
        },
        {
            id: "ad-2",
            badge: "AD",
            brand: "렌트리 정수기",
            title: "인기 정수기 반값할인 모음전",
            desc: "브랜드별 가격·지원금 비교부터 설치까지 한 번에!",
            cta: "자세히 보기",
            image:
                "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?q=80&w=1200&auto=format&fit=crop",
            href: "https://rentre.kr/affiliate/bridge/daiclo/watpu?utm_source=daiclo",
        },
        {
            id: "ad-3",
            badge: "AD",
            brand: "렌트리 인터넷",
            title: "지원금 업계 최대로 받고 인터넷 가입",
            desc: "더 높은 타사 혜택을 찾으시면 무조건 +2만원 더!",
            cta: "자세히 보기",
            image:
                "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?q=80&w=1200&auto=format&fit=crop",
            href: "https://rentre.kr/affiliate/bridge/daiclo/internet?utm_source=daiclo",
        },
        {
            id: "ad-4",
            badge: "AD",
            brand: "신호트리 꽃다발",
            title: "로맨틱한 파스텔 꽃다발 & 꽃바구니",
            desc: "전국 최저가 수준 53,000원 / 당일주문 4시간 내 배송",
            cta: "구매하기",
            image:
                "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1200&auto=format&fit=crop",
            href: "https://smartstore.naver.com/sinhotree/category/c7456945666d4966bef7e152846ddf23?cp=1",
        },
    ];

    return (
        <section className="mt-6">
            <div className="hidden">
                <Divider />

                <Link
                    href=""
                    className="mt-4 flex items-center justify-between rounded-2xl border bg-[#f7fafc] px-4 py-4"
                    style={{ borderColor: "#d7e3f0" }}
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e9edff] text-[#7c8cff]">
                            <Gift size={18} strokeWidth={2.2} />
                        </div>
                        <div>
                            <div className="text-[16px] font-bold text-neutral-900">
                                추천서비스 전체보기
                            </div>
                            <div className="mt-0.5 text-[13px] text-neutral-500">
                                여행특가, 추천서비스, 할인 모아보기
                            </div>
                        </div>
                    </div>

                    <ChevronRight size={18} className="text-neutral-400" />
                </Link>

                <div className="mt-4 overflow-hidden rounded-[22px] bg-white">
                    <a
                        href="https://discountallday.co.kr/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <div className="relative h-[212px] overflow-hidden rounded-[22px]">
                            <img
                                src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1600&auto=format&fit=crop"
                                alt="클로버 모집"
                                className="h-full w-full object-cover"
                            />

                            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" />

                            <div className="absolute right-4 top-4 rounded-full bg-black/35 px-2 py-1 text-[11px] font-medium text-white">
                                1 / 2
                            </div>

                            <div className="absolute bottom-5 left-4 right-4 text-white">
                                <div className="text-[18px] font-extrabold tracking-[-0.02em]">
                                    클로버 모집
                                </div>
                                <div className="mt-2 text-[14px] font-semibold">
                                    “픽업 은 김에, 집에 가는 길에”
                                </div>
                                <div className="mt-1 text-[13px] text-white/90">
                                    함께할 딜리버리 크루를 모집합니다.
                                </div>
                            </div>
                        </div>
                    </a>

                    <div className="flex items-center justify-center gap-1.5 py-3">
                        <span className="h-2 w-5 rounded-full bg-neutral-800" />
                        <span className="h-2 w-2 rounded-full bg-neutral-300" />
                    </div>
                </div>

                <Divider className="mt-5" />

                <section className="mt-5">
                    <div className="text-[18px] font-extrabold tracking-[-0.02em] text-neutral-900">
                        추천서비스
                    </div>

                    <div className="mt-4 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <div className="flex gap-3">
                            {serviceCards.map((card) => (
                                <a
                                    key={card.id}
                                    href={card.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="relative block h-[238px] w-[156px] flex-shrink-0 overflow-hidden rounded-2xl bg-white"
                                >
                                    <img
                                        src={card.image}
                                        alt={card.title}
                                        className="h-full w-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

                                    <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                                        <div className="line-clamp-2 text-[14px] font-bold leading-[1.35]">
                                            {card.title}
                                        </div>
                                        <div className="mt-1 line-clamp-2 text-[11px] leading-[1.4] text-white/90">
                                            {card.desc}
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                </section>

                <Divider className="mt-6" />
            </div>

            <section className="mt-6">
                <div className="text-[18px] font-extrabold tracking-[-0.02em] text-neutral-900">
                    이런 상품은 어때요?
                </div>

                <div className="mt-4 space-y-3">
                    {suggestList.map((item) => (
                        <a
                            key={item.id}
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-2xl border bg-white p-3"
                            style={{ borderColor: "#e8e8e8" }}
                        >
                            <div className="h-[82px] w-[82px] flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                                <img
                                    src={item.image}
                                    alt={item.title}
                                    className="h-full w-full object-cover"
                                />
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="rounded bg-[#f2f2f7] px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">
                                        {item.badge}
                                    </span>
                                    <span className="truncate text-[12px] text-neutral-500">
                                        {item.brand}
                                    </span>
                                </div>

                                <div className="mt-1 line-clamp-2 text-[18px] font-bold leading-[1.35] tracking-[-0.02em] text-neutral-900">
                                    {item.title}
                                </div>

                                <div className="mt-1 line-clamp-2 text-[14px] text-neutral-500">
                                    {item.desc}
                                </div>

                                <div className="mt-2 inline-flex items-center gap-1 text-[14px] font-semibold text-[#4f6df5]">
                                    {item.cta}
                                    <ChevronRight size={14} />
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            </section>
        </section>
    );
}

function Divider({ className = "" }: { className?: string }) {
    return (
        <div
            className={`h-[6px] w-full bg-[#efefef] ${className}`}
            style={{ borderRadius: 9999 }}
        />
    );
}