// src/app/(site)/[tenant]/(app)/goods/page.tsx
import { notFound } from "next/navigation";
import GoodsListClient, { type GoodsListItem } from "@/components/goods/GoodsListClient";
import { endpoints } from "@/lib/api/endpoints";
import { ssrHeaders } from "@/lib/api/ssrHeaders";
import { normalizeTenant } from "@/lib/tenant/getTenant";
import { toGoodsListItems } from "@/lib/goods/listItem";
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

// 무한 스크롤 한 페이지 크기. SSR 은 첫 페이지만 그리고 나머지는 스크롤 시 클라가 이어붙인다.
const PAGE_SIZE = 20;

async function fetchProducts(
    tenant: string,
    searchParams?: GoodsPageSearchParams
): Promise<{ items: GoodsListItem[]; hasMore: boolean }> {
    const origin = getInternalOrigin();
    const tab = normalizeTab(searchParams?.tab);
    const q = String(searchParams?.q ?? "").trim();

    const path = endpoints.publicProducts(tenant, {
        take: PAGE_SIZE,
        // '전체'(all)는 segment 미전달 → API가 진열 전체를 반환한다. today/ongoing만 type을 보낸다.
        ...(tab === "all" ? {} : { type: tab }),
        ...(q ? { q } : {}),
    });

    const url = new URL(path, origin);
    const res = await fetch(url.toString(), { cache: "no-store", headers: await ssrHeaders() });

    if (!res.ok) return { items: [], hasMore: false };

    const data = (await res.json().catch(() => null)) as PublicProductsResponse | null;
    if (!data?.ok) return { items: [], hasMore: false };

    return {
        // 비회원 마스킹(§8)은 공용 매퍼가 담당 — 추가 로드분과 같은 규칙을 쓴다
        items: toGoodsListItems(data.items),
        hasMore:
            typeof data.hasMore === "boolean"
                ? data.hasMore
                : (data.items?.length ?? 0) >= PAGE_SIZE,
    };
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

    const tab = normalizeTab(resolvedSearchParams?.tab);
    const listQuery = String(resolvedSearchParams?.q ?? "").trim();
    const { items, hasMore } = await fetchProducts(tenant, resolvedSearchParams);

    return (
        <GoodsListClient
            tenant={tenant}
            initialItems={items}
            initialHasMore={hasMore}
            pageSize={PAGE_SIZE}
            // 다음 페이지도 SSR 첫 페이지와 같은 조건으로 이어받아야 offset 이 어긋나지 않는다
            listType={tab === "all" ? undefined : tab}
            listQuery={listQuery || undefined}
        />
    );
}