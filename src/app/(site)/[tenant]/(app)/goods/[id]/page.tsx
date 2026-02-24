// src/app/(site)/[tenant]/(app)/goods/page.tsx
import GoodsListClient, { type GoodsListItem } from "@/components/goods/GoodsListClient";

type ProductsResponse = {
    ok: boolean;
    tenant?: string;
    items?: Array<{
        id: string;
        title: string;
        price: number;
        badgeLeft?: string;
        badgeRight?: string;
        metaLeft?: string;
        metaRight?: string;
        thumbnailUrl?: string;
    }>;
};

async function fetchProducts(tenant: string): Promise<GoodsListItem[]> {
    try {
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/proxy/${tenant}/v1/public/products`,
            { cache: "no-store" }
        );

        // NEXT_PUBLIC_BASE_URL 없으면 상대경로 fetch도 동작하게 fallback
        if (!res.ok) {
            const res2 = await fetch(`/api/proxy/${tenant}/v1/public/products`, { cache: "no-store" });
            const data2 = (await res2.json()) as ProductsResponse;
            return (data2.items ?? []).map((it) => ({
                id: String(it.id),
                title: it.title,
                price: Number(it.price ?? 0),
                badgeLeft: it.badgeLeft,
                badgeRight: it.badgeRight,
                metaLeft: it.metaLeft,
                metaRight: it.metaRight,
            }));
        }

        const data = (await res.json()) as ProductsResponse;
        return (data.items ?? []).map((it) => ({
            id: String(it.id),
            title: it.title,
            price: Number(it.price ?? 0),
            badgeLeft: it.badgeLeft,
            badgeRight: it.badgeRight,
            metaLeft: it.metaLeft,
            metaRight: it.metaRight,
        }));
    } catch {
        return [];
    }
}

export default async function GoodsListPage({
                                                params,
                                            }: {
    params: Promise<{ tenant: string }>;
}) {
    const { tenant } = await params;

    const items = await fetchProducts(tenant);

    return <GoodsListClient tenant={tenant} initialItems={items} />;
}