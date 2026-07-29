// src/components/home/AllProductsGrid.tsx
"use client";

import GoodsCard from "@/components/goods/GoodsCard";
import { InfiniteScrollFooter, type GoodsListItem } from "@/components/goods/GoodsListClient";
import { useInfiniteProducts } from "@/lib/goods/useInfiniteProducts";

/**
 * 홈 '전체 상품' 그리드 — 무한 스크롤.
 *
 * 레이아웃은 기존 GridAll(2열 grid + GoodsCard)을 그대로 유지하고, SSR 이 내려준 첫 페이지
 * 뒤로 스크롤이 바닥에 가까워질 때마다 다음 페이지를 이어붙인다.
 * 추가 로드분도 서버가 내려준 price/masked 를 그대로 쓰므로 비회원 마스킹이 유지된다.
 */
export default function AllProductsGrid(props: {
    tenant: string;
    initialItems: GoodsListItem[];
    initialHasMore: boolean;
    pageSize: number;
    emptyText: string;
}) {
    const { tenant, initialItems, initialHasMore, pageSize, emptyText } = props;

    const { items, hasMore, loading, error, retry, sentinelRef } = useInfiniteProducts({
        tenant,
        initialItems,
        initialHasMore,
        pageSize,
    });

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
        <>
            <section className="mt-3 grid grid-cols-2 gap-3">
                {items.map((it) => (
                    <GoodsCard key={it.id} tenant={tenant} item={it} />
                ))}
            </section>

            <InfiniteScrollFooter
                sentinelRef={sentinelRef}
                hasMore={hasMore}
                loading={loading}
                error={error}
                onRetry={retry}
                showEnd
            />
        </>
    );
}
