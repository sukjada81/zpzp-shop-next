// src/app/(site)/[tenant]/(app)/home/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Gift } from "lucide-react";
import HomeBannerCarousel from "@/components/home/HomeBannerCarousel";
import HomeCategoryIcons from "@/components/home/HomeCategoryIcons";
import RecentOrderTicker, { type RecentOrderTickerItem } from "@/components/home/RecentOrderTicker";
import HomeProfileGate from "@/components/profile/HomeProfileGate";
import OngoingGroupBuySection, { type OngoingGroupBuyItem } from "@/components/home/OngoingGroupBuySection";
import { endpoints } from "@/lib/api/endpoints";
import { normalizeTenant } from "@/lib/tenant/getTenant";
import type { PublicProductsResponse, PublicProductListItem, PublicProductDetailResponse } from "@/lib/types/goods";

type RecentOrdersResponse = {
    ok?: boolean;
    items?: RecentOrderTickerItem[];
};

type CardItem = {
    id: string;
    title: string;
    // 비회원 마스킹(§8): 비로그인이면 서버가 price=null + masked=true 로 내림
    price: number | null;
    masked?: boolean;
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
    try {
        const origin = getInternalOrigin();
        const path = endpoints.publicProducts(tenant, q);
        const url = new URL(path, origin);

        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) return [] as PublicProductsResponse["items"];

        const data = (await res.json().catch(() => null)) as PublicProductsResponse | null;
        if (!data?.ok) return [];

        return data.items ?? [];
    } catch {
        return [] as PublicProductsResponse["items"];
    }
}

async function fetchRecentOrders(tenant: string, take = 10): Promise<RecentOrderTickerItem[]> {
    try {
        const origin = getInternalOrigin();
        const path = endpoints.publicRecentOrders(tenant, { take });
        const url = new URL(path, origin);

        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) return [];

        const data = (await res.json().catch(() => null)) as RecentOrdersResponse | null;
        if (!data?.ok || !Array.isArray(data.items)) return [];

        return data.items;
    } catch {
        return [];
    }
}

async function fetchProductDetail(
    tenant: string,
    id: string | number
): Promise<PublicProductDetailResponse["product"] | null> {
    try {
        const origin = getInternalOrigin();
        const url = new URL(endpoints.publicProductDetail(tenant, id), origin);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) return null;
        const data = (await res.json().catch(() => null)) as PublicProductDetailResponse | null;
        return data?.product ?? null;
    } catch {
        return null;
    }
}

function displayCategoryLabel(label?: string) {
    if (label === "오늘의 공구") return "오늘의 공구";
    // 줍줍은 배송 전용, 정책 변경 대비 보존 — "바로 픽업 가능" 카테고리 배지는 노출하지 않음
    if (label === "바로 픽업 가능") return undefined;
    return label;
}

function toCardItems(items: PublicProductsResponse["items"]): CardItem[] {
    return (items ?? []).map((p) => ({
        id: String(p.id ?? ""),
        title: String(p.title ?? ""),
        // 비회원 마스킹(§8): null을 0으로 접지 말 것 — null이어야 "?????원"으로 표시된다
        price: p.price == null ? null : Number(p.price),
        masked: p.masked ?? p.price == null,
        thumbnailUrl: p.thumbnailUrl,
        cate: p.cate ?? null,
        categoryLabel: displayCategoryLabel(p.categoryLabel),
        tags: [...(p.metaLeft ? [p.metaLeft] : []), ...(p.metaRight ? [p.metaRight] : [])].slice(0, 2),
    }));
}

function toOngoingItems(
    products: PublicProductListItem[],
    tenant: string,
    recentOrders: RecentOrderTickerItem[],
    details: (PublicProductDetailResponse["product"] | null)[]
): OngoingGroupBuyItem[] {
    return (products ?? []).map((p, i) => {
        const detail = details[i] ?? null;

        // 이미지: 상세 API > 목록 API images[] > thumbnailUrl 순으로 폴백
        const rawImages =
            Array.isArray(detail?.images) && detail.images.length
                ? detail.images
                : Array.isArray(p.images) && p.images.length
                    ? p.images
                    : null;

        const images = rawImages
            ? rawImages.map((img) => ({ key: img.key, label: img.label }))
            : p.thumbnailUrl
                ? [{ key: p.thumbnailUrl, label: p.title }]
                : [];

        // 옵션: 상세 API > 목록 API 순으로 폴백
        const rawOptions =
            Array.isArray(detail?.options) && detail.options.length
                ? detail.options
                : Array.isArray(p.options) && p.options.length
                    ? p.options
                    : [];

        const options = rawOptions.map((o) => ({
            id: String(o.id),
            name: String(o.name ?? ""),
            price: o.price === null || o.price === undefined ? null : Number(o.price),
            addPrice: o.addPrice === undefined ? undefined : Number(o.addPrice),
            qty: o.qty === undefined ? undefined : Number(o.qty),
            qtyType: o.qtyType === undefined ? undefined : Number(o.qtyType),
            soldout: !!o.soldout,
            stockNote: o.stockNote,
            rawOptionId: o.rawOptionId,
            code: o.code,
        }));

        return {
            id: String(p.id),
            tenant,
            title: String(p.title ?? ""),
            // 비회원 마스킹(§8): null 보존
            price: p.price == null ? null : Number(p.price),
            masked: p.masked ?? p.price == null,
            href: `/${tenant}/goods/${p.id}`,
            images,
            options,
            meta: {
                deadlineAt: p.saleEndAt ?? null,
                timeLeft: p.metaLeft ?? undefined,
                pickup: p.metaRight ?? undefined,
                pickupStartAt: p.pickupStartAt ?? null,
                pickupEndAt: p.pickupEndAt ?? null,
            },
            recentOrders,
        };
    });
}

function categoryBadgeColor(label?: string) {
    if (label === "오늘의 공구") return "bg-amber-500 text-white";
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

    // 줍줍은 배송 전용, 정책 변경 대비 보존 — 픽업 상품 조회 중단(fetchProducts type:"pickup")
    const [todayProducts, recentOrders] = await Promise.all([
        fetchProducts(tenant, { take: 10, type: "today" }),
        // fetchProducts(tenant, { take: 8, type: "pickup" }),
        fetchRecentOrders(tenant, 10),
    ]);

    // 오늘의공구 상품마다 상세 API를 병렬 호출 → 추가 이미지 + 옵션 확보
    const ongoingDetails = await Promise.all(
        todayProducts.map((p) => fetchProductDetail(tenant, p.id))
    );

    const todaySection: GridSection = {
        title: "🛒 오늘의 공구",
        href: `/${tenant}/goods?tab=today`,
        items: toCardItems(todayProducts),
    };

    // 줍줍은 배송 전용, 정책 변경 대비 보존 — "바로 픽업 가능" 섹션 정의/노출 중단
    // const pickupSection: GridSection = {
    //     title: "📦 바로 픽업 가능",
    //     href: `/${tenant}/goods?tab=pickup`,
    //     items: toCardItems(pickupProducts),
    // };

    return (
        <main className="mx-auto w-full max-w-[520px] px-4 pb-28 pt-3">
            <HomeProfileGate tenant={tenant} />

            <HomeBannerCarousel tenant={tenant} />
            <RecentOrderTicker items={recentOrders} />

            <div className="hidden">
                <HomeCategoryIcons tenant={tenant} />
            </div>

            <SectionTitle
                title={todaySection.title}
                href={todaySection.href}
                description={todaySection.description}
            />
            <Grid2 tenant={tenant} items={todaySection.items} emptyText="등록된 상품이 없습니다." />

            {/* 줍줍은 배송 전용, 정책 변경 대비 보존 — "바로 픽업 가능" 섹션 노출 중단
            <SectionTitle
                title={pickupSection.title}
                href={pickupSection.href}
                description={pickupSection.description}
            />
            <Grid2 tenant={tenant} items={pickupSection.items} emptyText="등록된 상품이 없습니다." />
            */}

            {todayProducts.length > 0 && (
                <OngoingGroupBuySection
                    items={toOngoingItems(todayProducts, tenant, recentOrders, ongoingDetails)}
                />
            )}

            <RecommendedBlock tenant={tenant} />
        </main>
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
            desc: "신세계상품권 최대 30만원 + 디스카운트 올데이 5만 포인트",
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

            {/*<section className="mt-6">*/}
            {/*    <div className="text-[18px] font-extrabold tracking-[-0.02em] text-neutral-900">*/}
            {/*        이런 상품은 어때요?*/}
            {/*    </div>*/}

            {/*    <div className="mt-4 space-y-3">*/}
            {/*        {suggestList.map((item) => (*/}
            {/*            <a*/}
            {/*                key={item.id}*/}
            {/*                href={item.href}*/}
            {/*                target="_blank"*/}
            {/*                rel="noopener noreferrer"*/}
            {/*                className="flex items-center gap-3 rounded-2xl border bg-white p-3"*/}
            {/*                style={{ borderColor: "#e8e8e8" }}*/}
            {/*            >*/}
            {/*                <div className="h-[82px] w-[82px] flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100">*/}
            {/*                    <img*/}
            {/*                        src={item.image}*/}
            {/*                        alt={item.title}*/}
            {/*                        className="h-full w-full object-cover"*/}
            {/*                    />*/}
            {/*                </div>*/}

            {/*                <div className="min-w-0 flex-1">*/}
            {/*                    <div className="flex items-center gap-2">*/}
            {/*                        <span className="rounded bg-[#f2f2f7] px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">*/}
            {/*                            {item.badge}*/}
            {/*                        </span>*/}
            {/*                        <span className="truncate text-[12px] text-neutral-500">*/}
            {/*                            {item.brand}*/}
            {/*                        </span>*/}
            {/*                    </div>*/}

            {/*                    <div className="mt-1 line-clamp-2 text-[18px] font-bold leading-[1.35] tracking-[-0.02em] text-neutral-900">*/}
            {/*                        {item.title}*/}
            {/*                    </div>*/}

            {/*                    <div className="mt-1 line-clamp-2 text-[14px] text-neutral-500">*/}
            {/*                        {item.desc}*/}
            {/*                    </div>*/}

            {/*                    <div className="mt-2 inline-flex items-center gap-1 text-[14px] font-semibold text-[#4f6df5]">*/}
            {/*                        {item.cta}*/}
            {/*                        <ChevronRight size={14} />*/}
            {/*                    </div>*/}
            {/*                </div>*/}
            {/*            </a>*/}
            {/*        ))}*/}
            {/*    </div>*/}
            {/*</section>*/}
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