// src/app/(site)/[tenant]/(app)/home/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import HomeBannerCarousel from "@/components/home/HomeBannerCarousel";
import HomeCategoryIcons from "@/components/home/HomeCategoryIcons";
import OngoingGroupBuySection, { type OngoingGroupBuyItem } from "@/components/home/OngoingGroupBuySection";
import { endpoints } from "@/lib/api/endpoints";
import { normalizeTenant } from "@/lib/tenant/getTenant";
import type { PublicProductsResponse } from "@/lib/types/goods";

type CardItem = {
    id: string;
    title: string;
    price: number;
    tags?: string[];
    thumbnailUrl?: string;
};

type GridSection = {
    title: string;
    href: string;
    items: CardItem[];
};

type ProductDetailResponse = {
    ok: true;
    tenant?: string;
    product: {
        id: string;
        title: string;
        price: number;
        description?: string | null;
        meta?: { timeLeft?: string; pickup?: string };
        images: { key: string; label?: string }[];
        options: Array<{
            id: string;
            name: string;
            price: number | null;
            soldout?: boolean;
            stockNote?: string;
        }>;
    };
};

function getInternalOrigin() {
    return process.env.NEXT_INTERNAL_ORIGIN || process.env.NEXT_PUBLIC_BASE_URL || "http://127.0.0.1:3000";
}

async function fetchProducts(tenant: string) {
    const origin = getInternalOrigin();
    const path = endpoints.publicProducts(tenant, { take: 100 });
    const url = new URL(path, origin);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [] as PublicProductsResponse["items"];

    const data = (await res.json().catch(() => null)) as PublicProductsResponse | null;
    if (!data?.ok) return [];

    return data.items ?? [];
}

async function fetchProductDetail(tenant: string, id: string) {
    const origin = getInternalOrigin();
    const path = endpoints.publicProductDetail(tenant, id);
    const url = new URL(path, origin);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;

    const data = (await res.json().catch(() => null)) as ProductDetailResponse | null;
    if (!data?.ok) return null;

    return data.product ?? null;
}

function toCardItems(items: PublicProductsResponse["items"]): CardItem[] {
    return (items ?? []).map((p) => ({
        id: String(p.id),
        title: String(p.title ?? ""),
        price: Number(p.price ?? 0),
        thumbnailUrl: p.thumbnailUrl,
        tags: [...(p.metaLeft ? [p.metaLeft] : []), ...(p.metaRight ? [p.metaRight] : [])].slice(0, 2),
    }));
}

function getMockRecentOrders() {
    return [
        { id: "1", maskedName: "제**5**", minutesAgo: 1, qty: 10 },
        { id: "2", maskedName: "금****8", minutesAgo: 9, qty: 1 },
        { id: "3", maskedName: "박**3*", minutesAgo: 14, qty: 3 },
        { id: "4", maskedName: "김***7", minutesAgo: 22, qty: 2 },
        { id: "5", maskedName: "이**9*", minutesAgo: 35, qty: 6 },
    ];
}

export default async function HomePage({
                                           params,
                                       }: {
    params: { tenant: string } | Promise<{ tenant: string }>;
}) {
    const resolved = await Promise.resolve(params);
    const tenant = normalizeTenant(resolved?.tenant);

    if (!tenant) notFound();

    const products = await fetchProducts(tenant);
    const pickup = products.filter((p) => (p.metaRight || "").includes("픽업"));

    const todaySection: GridSection = {
        title: "오늘의 공구",
        href: `/${tenant}/goods?tab=today`,
        items: toCardItems(products.slice(0, 4)),
    };

    const pickupSection: GridSection = {
        title: "바로 픽업 가능",
        href: `/${tenant}/goods?tab=pickup`,
        items: toCardItems(pickup.slice(0, 4)),
    };

    const mockOrders = getMockRecentOrders();

    // 판매기간 조건에 맞아 공개 API에 노출된 상품 전부를 진행 중인 공구에 사용
    const ongoingBase = products;

    const ongoingDetails = await Promise.all(
        ongoingBase.map(async (p, index) => {
            const detail = await fetchProductDetail(tenant, String(p.id));

            const item: OngoingGroupBuyItem = {
                id: String(p.id),
                tenant,
                title: String(detail?.title ?? p.title ?? ""),
                price: Number(detail?.price ?? p.price ?? 0),
                images: detail?.images?.length
                    ? detail.images
                    : p.thumbnailUrl
                        ? [{ key: p.thumbnailUrl, label: "대표 이미지" }]
                        : [],
                options: detail?.options?.length
                    ? detail.options
                    : [
                        {
                            id: `base_${p.id}`,
                            name: String(detail?.title ?? p.title ?? ""),
                            price: Number(detail?.price ?? p.price ?? 0),
                            soldout: false,
                        },
                    ],
                meta: detail?.meta ?? {
                    timeLeft: p.metaLeft,
                    pickup: p.metaRight,
                },
                notice: mockOrders[index % mockOrders.length],
            };

            return item;
        })
    );

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24">
            <HomeBannerCarousel tenant={tenant} />
            <HomeCategoryIcons tenant={tenant} />

            <SectionTitle title={todaySection.title} href={todaySection.href} />
            <Grid2 tenant={tenant} items={todaySection.items} emptyText="등록된 상품이 없습니다." />

            <SectionTitle title={pickupSection.title} href={pickupSection.href} />
            <Grid2 tenant={tenant} items={pickupSection.items} emptyText="픽업 가능한 상품이 없습니다." />

            <OngoingGroupBuySection title="진행 중인 공구" items={ongoingDetails} />

            <section className="mt-6">
                <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
                    <div className="relative h-[230px]" style={{ background: "var(--brand)" }}>
                        <div className="absolute inset-0 p-5 text-white">
                            <div className="text-[22px] font-extrabold leading-tight">장기렌트/리스</div>
                            <div className="mt-2 text-sm font-bold opacity-95">빠르게 견적 받아보세요</div>

                            <div className="absolute bottom-4 left-4 right-4">
                                <div className="rounded-2xl bg-white/90 p-3 text-[color:var(--fg)]">
                                    <div className="text-xs font-bold">신차 장기렌트/리스</div>
                                    <div className="mt-1 text-[11px] text-[color:var(--muted)]">
                                        상담 신청 후 안내드립니다.
                                    </div>
                                    <button
                                        type="button"
                                        className="mt-3 w-full rounded-xl py-3 text-sm font-extrabold text-white active:scale-[0.99]"
                                        style={{ background: "var(--accent)" }}
                                    >
                                        상담 신청
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}

function SectionTitle({ title, href }: { title: string; href: string }) {
    return (
        <section className="mt-6">
            <div className="flex items-center justify-between">
                <div className="text-base font-extrabold text-[color:var(--fg)]">{title}</div>
                <Link href={href} className="text-xs font-bold text-[color:var(--muted)] hover:opacity-80">
                    더보기 &gt;
                </Link>
            </div>
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
        <section className="mt-3 grid grid-cols-2 gap-3">
            {items.map((it) => (
                <Link
                    key={it.id}
                    href={`/${tenant}/goods/${it.id}`}
                    className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm active:scale-[0.995]"
                >
                    <div className="aspect-[4/3] bg-[color:var(--brand-soft)]">
                        {it.thumbnailUrl ? (
                            <img src={it.thumbnailUrl} alt={it.title} className="h-full w-full object-cover" />
                        ) : (
                            <div className="h-full w-full bg-gradient-to-br from-white to-[color:var(--brand-soft)]" />
                        )}
                    </div>

                    <div className="p-3">
                        <div className="line-clamp-2 text-[13px] font-extrabold text-[color:var(--fg)]">{it.title}</div>

                        <div className="mt-2 flex items-center justify-between">
                            <div className="text-[15px] font-extrabold tabular-nums text-[color:var(--fg)]">
                                {it.price.toLocaleString()}원
                            </div>
                        </div>

                        {it.tags?.length ? (
                            <div className="mt-2 space-y-1">
                                {it.tags.slice(0, 2).map((t) => (
                                    <div
                                        key={t}
                                        className="inline-flex max-w-full items-center rounded-full bg-[color:var(--accent-soft)] px-2 py-1 text-[11px] font-bold text-[color:var(--brand)]"
                                    >
                                        <span className="truncate">{t}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        <div className="mt-3">
                            <div className="w-full rounded-xl border border-[color:var(--border)] bg-white py-2 text-center text-[12px] font-extrabold text-[color:var(--brand)]">
                                자세히 보기
                            </div>
                        </div>
                    </div>
                </Link>
            ))}
        </section>
    );
}