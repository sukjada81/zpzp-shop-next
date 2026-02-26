// src/app/(site)/[tenant]/(app)/goods/page.tsx
import { notFound } from "next/navigation";
import GoodsListClient, { type GoodsListItem } from "@/components/goods/GoodsListClient";

type PublicProductsResponse = {
    ok: true;
    tenant: string;
    items: Array<{
        id: string | number;
        title: string;
        price: number;
        badgeLeft?: string;
        badgeRight?: string;
        metaLeft?: string;
        metaRight?: string;
    }>;
};

function normalizeTenant(raw: string) {
    const t = (raw || "").toLowerCase().trim();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

function getBaseUrl() {
    return (
        process.env.NEXT_PUBLIC_BASE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    );
}

async function fetchProducts(tenant: string) {
    const baseUrl = getBaseUrl();
    const url = new URL(`/api/proxy/${tenant}/v1/public/products`, baseUrl);
    url.searchParams.set("take", "200");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [] as PublicProductsResponse["items"];

    const data = (await res.json().catch(() => null)) as PublicProductsResponse | null;
    if (!data || data.ok !== true) return [];

    return data.items ?? [];
}

function toGoodsListItems(items: PublicProductsResponse["items"]): GoodsListItem[] {
    return (items ?? []).map((p) => ({
        id: String(p.id),
        title: String(p.title ?? ""),
        price: Number(p.price ?? 0),
        badgeLeft: p.badgeLeft,
        badgeRight: p.badgeRight,
        metaLeft: p.metaLeft,
        metaRight: p.metaRight,
    }));
}

export default async function GoodsPage({
                                            params,
                                        }: {
    // ✅ Next.js 16: params Promise 대응
    params: { tenant: string } | Promise<{ tenant: string }>;
}) {
    const resolved = await Promise.resolve(params);
    const tenant = normalizeTenant(resolved?.tenant);

    if (!tenant) notFound();

    const products = await fetchProducts(tenant);
    const initialItems = toGoodsListItems(products);

    return <GoodsListClient tenant={tenant} initialItems={initialItems} />;
}