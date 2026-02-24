// src/app/(site)/[tenant]/(app)/home/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import HomeBannerCarousel from "@/components/home/HomeBannerCarousel";
import HomeCategoryIcons from "@/components/home/HomeCategoryIcons";

type CardItem = {
    id: string;
    title: string;
    price: number;
    tags?: string[];
};

type GridSection = {
    title: string;
    href: string;
    items: CardItem[];
};

type PublicProductsResponse = {
    ok: true;
    tenant: string;
    items: Array<{
        id: string;
        title: string;
        price: number;
        metaLeft?: string;
        metaRight?: string; // "픽업" 같은 값
    }>;
};

async function fetchProducts(tenant: string) {
    const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL ||
        (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000");

    const url = new URL(`/api/proxy/${tenant}/v1/public/products`, baseUrl);
    url.searchParams.set("take", "50");

    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) return [];

    const data = (await res.json().catch(() => null)) as PublicProductsResponse | null;
    if (!data || data.ok !== true) return [];

    return data.items ?? [];
}

function toCardItems(items: PublicProductsResponse["items"]): CardItem[] {
    return items.map((p) => ({
        id: String(p.id),
        title: p.title,
        price: Number(p.price ?? 0),
        tags: [
            ...(p.metaLeft ? [p.metaLeft] : []),
            ...(p.metaRight ? [p.metaRight] : []),
        ].slice(0, 2),
    }));
}

export default async function HomePage({
                                           params,
                                       }: {
    params: Promise<{ tenant: string }>;
}) {
    const { tenant: rawTenant } = await params;
    const tenant = (rawTenant || "").toLowerCase().trim();
    if (!tenant || tenant === "undefined" || tenant === "null") notFound();

    const products = await fetchProducts(tenant);

    // 섹션 구성 (MVP)
    const pickup = products.filter((p) => (p.metaRight || "").includes("픽업"));
    const nonPickup = products.filter((p) => !(p.metaRight || "").includes("픽업"));

    const todaySection: GridSection = {
        title: "오늘의 공구",
        href: `/${tenant}/goods`,
        items: toCardItems(nonPickup.slice(0, 4)),
    };

    const pickupSection: GridSection = {
        title: "바로 픽업 가능",
        href: `/${tenant}/goods`,
        items: toCardItems(pickup.slice(0, 4)),
    };

    const ongoingSection: GridSection = {
        title: "진행 중인 공구",
        href: `/${tenant}/goods`,
        items: toCardItems(products.slice(0, 6)),
    };

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24">
            <HomeBannerCarousel tenant={tenant} />
            <HomeCategoryIcons tenant={tenant} />

            <SectionTitle title={todaySection.title} href={todaySection.href} />
            <Grid2 tenant={tenant} items={todaySection.items} emptyText="등록된 상품이 없습니다." />

            <SectionTitle title={pickupSection.title} href={pickupSection.href} />
            <Grid2 tenant={tenant} items={pickupSection.items} emptyText="픽업 가능한 상품이 없습니다." />

            <SectionTitle title={ongoingSection.title} href={ongoingSection.href} />
            <Grid2 tenant={tenant} items={ongoingSection.items} emptyText="진행 중인 공구가 없습니다." />

            {/* 프로모 카드(현재는 고정 UI 유지) */}
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
                                    <div className="mt-1 text-[11px] text-slate-600">상담 신청 후 안내드립니다.</div>
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
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600">
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
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden active:scale-[0.995]"
                >
                    <div className="aspect-[4/3] bg-slate-100">
                        <div className="h-full w-full bg-gradient-to-br from-slate-100 to-slate-200" />
                    </div>

                    <div className="p-3">
                        <div className="line-clamp-2 text-[13px] font-extrabold text-slate-900">{it.title}</div>

                        <div className="mt-2 flex items-center justify-between">
                            <div className="text-[15px] font-extrabold tabular-nums text-slate-900">
                                {it.price.toLocaleString()}원
                            </div>
                        </div>

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