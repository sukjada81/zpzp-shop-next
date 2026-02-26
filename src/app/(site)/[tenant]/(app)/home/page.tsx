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
        metaRight?: string;
    }>;
};

async function fetchProducts(tenant: string) {
    const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

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
        tags: [...(p.metaLeft ? [p.metaLeft] : []), ...(p.metaRight ? [p.metaRight] : [])].slice(0, 2),
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
    const pickup = products.filter((p) => (p.metaRight || "").includes("픽업"));

    const todaySection: GridSection = {
        title: "오늘의 공구",
        href: `/${tenant}/goods`,
        items: toCardItems(products.slice(0, 4)),
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

            {/* ✅ 프로모 카드: 그라데이션 제거 + 문구 짧게 */}
            <section className="mt-6">
                <div className="rounded-2xl overflow-hidden border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
                    <div
                        className="h-[230px] relative"
                        style={{
                            background: "var(--brand)",
                        }}
                    >
                        <div className="absolute inset-0 p-5 text-white">
                            <div className="text-[22px] font-extrabold leading-tight">
                                장기렌트/리스
                            </div>
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
                    className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm overflow-hidden active:scale-[0.995]"
                >
                    <div className="aspect-[4/3] bg-[color:var(--brand-soft)]">
                        <div className="h-full w-full bg-gradient-to-br from-white to-[color:var(--brand-soft)]" />
                    </div>

                    <div className="p-3">
                        <div className="line-clamp-2 text-[13px] font-extrabold text-[color:var(--fg)]">
                            {it.title}
                        </div>

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