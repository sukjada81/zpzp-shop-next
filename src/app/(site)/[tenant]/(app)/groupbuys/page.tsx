// src/app/(site)/[tenant]/(app)/groupbuys/page.tsx
import { notFound } from "next/navigation";
import { normalizeTenant } from "@/lib/tenant/getTenant";
import { endpoints } from "@/lib/api/endpoints";
import OngoingGroupBuySection, { type OngoingGroupBuyItem } from "@/components/home/OngoingGroupBuySection";
import type { RecentOrderTickerItem } from "@/components/home/RecentOrderTicker";
import type { PublicProductsResponse, PublicProductListItem, PublicProductDetailResponse } from "@/lib/types/goods";

// ─── Data fetching ────────────────────────────────────────────────────────────

function getInternalOrigin() {
    return process.env.NEXT_INTERNAL_ORIGIN || process.env.NEXT_PUBLIC_BASE_URL || "http://127.0.0.1:3000";
}

async function fetchRecentOrders(tenant: string): Promise<RecentOrderTickerItem[]> {
    try {
        const origin = getInternalOrigin();
        const url = new URL(endpoints.publicRecentOrders(tenant, { take: 10 }), origin);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) return [];
        const data = await res.json().catch(() => null);
        if (!data?.ok || !Array.isArray(data.items)) return [];
        return data.items as RecentOrderTickerItem[];
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

function mapProductToItem(
    p: PublicProductListItem,
    tenant: string,
    recentOrders: RecentOrderTickerItem[],
    detail: PublicProductDetailResponse["product"] | null
): OngoingGroupBuyItem {
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
        // 비회원 마스킹(§8): null을 0으로 접지 말 것 — null이어야 "?????원"으로 표시된다
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
}

async function fetchOngoingItems(tenant: string): Promise<OngoingGroupBuyItem[]> {
    try {
        const origin = getInternalOrigin();
        const url = new URL(endpoints.publicOngoingProducts(tenant, { take: 20 }), origin);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) return [];

        const data = (await res.json().catch(() => null)) as PublicProductsResponse | null;
        if (!data?.ok || !Array.isArray(data.items) || !data.items.length) return [];

        const [recentOrders, details] = await Promise.all([
            fetchRecentOrders(tenant),
            Promise.all(data.items.map((p) => fetchProductDetail(tenant, p.id))),
        ]);

        return data.items.map((p, i) => mapProductToItem(p, tenant, recentOrders, details[i] ?? null));
    } catch {
        return [];
    }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GroupBuysPage({
    params,
}: {
    params: { tenant: string } | Promise<{ tenant: string }>;
}) {
    const resolved = await Promise.resolve(params);
    const tenant = normalizeTenant(resolved?.tenant);
    if (!tenant) notFound();

    const items = await fetchOngoingItems(tenant);

    return (
        <main className="mx-auto w-full max-w-[520px] px-4 pb-28 pt-4">
            <OngoingGroupBuySection items={items} />
        </main>
    );
}
