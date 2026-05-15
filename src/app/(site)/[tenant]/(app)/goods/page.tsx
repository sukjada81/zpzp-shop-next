// src/app/(site)/[tenant]/(app)/goods/page.tsx
import { notFound } from "next/navigation";
import GoodsListClient, { type GoodsListItem } from "@/components/goods/GoodsListClient";
import { endpoints } from "@/lib/api/endpoints";
import { normalizeTenant } from "@/lib/tenant/getTenant";
import type { PublicProductsResponse } from "@/lib/types/goods";

function getInternalOrigin() {
    return process.env.NEXT_INTERNAL_ORIGIN || process.env.NEXT_PUBLIC_BASE_URL || "http://127.0.0.1:3000";
}

type GoodsPageSearchParams = {
    tab?: string;
    q?: string;
};

function normalizeTab(tab?: string): "today" | "pickup" | "ongoing" {
    if (tab === "pickup") return "pickup";
    if (tab === "ongoing") return "ongoing";
    return "today";
}

async function fetchProducts(
    tenant: string,
    searchParams?: GoodsPageSearchParams
): Promise<GoodsListItem[]> {
    const origin = getInternalOrigin();
    const tab = normalizeTab(searchParams?.tab);
    const q = String(searchParams?.q ?? "").trim();

    const path = endpoints.publicProducts(tenant, {
        take: 200,
        type: tab,
        ...(q ? { q } : {}),
    });

    const url = new URL(path, origin);
    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) return [];

    const data = (await res.json().catch(() => null)) as PublicProductsResponse | null;
    if (!data?.ok) return [];

    return (data.items ?? []).map((p) => ({
        id: String(p.id),
        title: String(p.title ?? ""),
        price: Number(p.price ?? 0),
        badgeLeft: undefined,
        badgeRight: undefined,
        metaLeft: p.metaLeft,
        metaRight: p.metaRight,
        thumbnailUrl: p.thumbnailUrl,
        cate: p.cate ?? null,
        categoryLabel: (p as any).categoryLabel ?? undefined,
        saleEndAt: p.saleEndAt ?? null,
        pickupStartAt: p.pickupStartAt ?? null,
        pickupEndAt: p.pickupEndAt ?? null,
    }));
}

export default async function GoodsPage({
                                            params,
                                            searchParams,
                                        }: {
    params: { tenant: string } | Promise<{ tenant: string }>;
    searchParams?: GoodsPageSearchParams | Promise<GoodsPageSearchParams>;
}) {
    const resolvedParams = await Promise.resolve(params);
    const resolvedSearchParams = await Promise.resolve(searchParams);

    const tenant = normalizeTenant(resolvedParams?.tenant);
    if (!tenant) notFound();

    const items = await fetchProducts(tenant, resolvedSearchParams);

    return <GoodsListClient tenant={tenant} initialItems={items} />;
}