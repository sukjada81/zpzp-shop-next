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

function normalizeTab(tab?: string): "all" | "today" | "ongoing" {
    // 노출 플랜B: 링커 스토어 기본 뷰를 '진열 전체'로 변경(기존 today 고정 → 공구 딜 없으면 미노출로 보임).
    // today/ongoing 탭은 유지 — 공구 딜이 생기면 기존대로 동작한다.
    // 줍줍은 배송 전용, 정책 변경 대비 보존 — 픽업 탭 진입 차단(들어오면 전체로 폴백)
    // if (tab === "pickup") return "pickup";
    if (tab === "today") return "today";
    if (tab === "ongoing") return "ongoing";
    return "all";
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
        // '전체'(all)는 segment 미전달 → API가 진열 전체를 반환한다. today/ongoing만 type을 보낸다.
        ...(tab === "all" ? {} : { type: tab }),
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
        // 비회원 마스킹(§8): null을 0으로 접지 말 것 — null이어야 "?????원"으로 표시된다
        price: p.price == null ? null : Number(p.price),
        masked: p.masked ?? p.price == null,
        badgeLeft: undefined,
        badgeRight: undefined,
        metaLeft: p.metaLeft,
        metaRight: p.metaRight,
        thumbnailUrl: p.thumbnailUrl,
        cate: p.cate ?? null,
        categoryLabel: (p as any).categoryLabel ?? undefined,
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