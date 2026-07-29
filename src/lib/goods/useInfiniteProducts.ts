// src/lib/goods/useInfiniteProducts.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GoodsListItem } from "@/components/goods/GoodsListClient";
import { endpoints, tenantHeader } from "@/lib/api/endpoints";
import { toGoodsListItems } from "@/lib/goods/listItem";
import type { PublicProductsResponse } from "@/lib/types/goods";

export type UseInfiniteProductsInput = {
    tenant: string;
    /** SSR 첫 페이지 */
    initialItems: GoodsListItem[];
    initialHasMore: boolean;
    pageSize: number;
    /** SSR 첫 페이지와 같은 조건으로 이어받아야 skip 이 어긋나지 않는다 */
    type?: "today" | "pickup" | "ongoing";
    q?: string;
};

/**
 * 상품 목록 무한 스크롤.
 *
 * - 다음 페이지는 브라우저에서 /api/proxy 로 부른다. 링커 서브도메인에서는 proxy 의
 *   resolveTenant 가 호스트(링커 slug)를 경로보다 우선해 400 TENANT_NOT_RESOLVED 가 나므로
 *   tenantHeader(tenant) 로 x-tenant-slug 를 명시한다(결제 호출과 같은 이유).
 * - 쿠키는 same-origin fetch 라 자동 전송되고 proxy 가 그대로 상류에 넘긴다.
 *   따라서 세션(가격 마스킹 판정)과 zpzp_ref(링커 진열)가 SSR 첫 페이지와 동일하게 적용된다.
 * - 마스킹은 서버가 price=null 로 내려주는 값을 그대로 쓴다(toGoodsListItems). 클라에서
 *   가격을 만들어내지 않는다.
 */
export function useInfiniteProducts(input: UseInfiniteProductsInput) {
    const { tenant, initialItems, initialHasMore, pageSize, type, q } = input;

    const [items, setItems] = useState<GoodsListItem[]>(initialItems);
    const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const skipRef = useRef<number>(initialItems.length);
    const loadingRef = useRef(false);
    // loadMore 는 setState 반영 전에도 호출될 수 있어(재시도 버튼) 가드는 ref 로 본다.
    const hasMoreRef = useRef<boolean>(initialHasMore);
    const seenRef = useRef<Set<string>>(new Set(initialItems.map((it) => it.id)));
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    // 탭 전환 등으로 SSR 첫 페이지가 갈리면 페이징 상태를 처음부터 다시 잡는다.
    useEffect(() => {
        setItems(initialItems);
        setHasMore(initialHasMore);
        setError(null);
        skipRef.current = initialItems.length;
        hasMoreRef.current = initialHasMore;
        seenRef.current = new Set(initialItems.map((it) => it.id));
    }, [initialItems, initialHasMore]);

    const applyHasMore = useCallback((next: boolean) => {
        hasMoreRef.current = next;
        setHasMore(next);
    }, []);

    const loadMore = useCallback(async () => {
        if (loadingRef.current) return;
        if (!hasMoreRef.current) return;

        loadingRef.current = true;
        setLoading(true);
        setError(null);

        try {
            const path = endpoints.publicProducts(tenant, {
                take: pageSize,
                skip: skipRef.current,
                ...(type ? { type } : {}),
                ...(q ? { q } : {}),
            });

            const res = await fetch(path, {
                cache: "no-store",
                headers: { accept: "application/json", ...tenantHeader(tenant) },
            });

            if (!res.ok) throw new Error(`HTTP_${res.status}`);

            const data = (await res.json().catch(() => null)) as PublicProductsResponse | null;
            if (!data?.ok) throw new Error("BAD_RESPONSE");

            const next = toGoodsListItems(data.items);

            // 정렬 기준(sort_order/moddate)이 조회 사이에 바뀌면 offset 페이징은 중복이 섞일 수
            // 있다. 화면에 같은 카드가 두 번 뜨는 것만은 막는다.
            const fresh = next.filter((it) => it.id && !seenRef.current.has(it.id));
            fresh.forEach((it) => seenRef.current.add(it.id));

            skipRef.current =
                typeof data.nextSkip === "number"
                    ? data.nextSkip
                    : skipRef.current + (data.items?.length ?? 0);

            if (fresh.length) setItems((prev) => [...prev, ...fresh]);

            // hasMore 필드가 없는 구버전 API 응답이면 받은 개수로 판정한다.
            const more =
                typeof data.hasMore === "boolean"
                    ? data.hasMore
                    : (data.items?.length ?? 0) >= pageSize;

            applyHasMore(more);
        } catch {
            setError("상품을 더 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
            applyHasMore(false);
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }, [applyHasMore, pageSize, q, tenant, type]);

    // 하단 감시자. rootMargin 을 넉넉히 줘서 바닥에 닿기 전에 미리 채운다.
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;
        if (!hasMore) return;
        if (typeof IntersectionObserver === "undefined") return;

        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) void loadMore();
            },
            { rootMargin: "600px 0px" }
        );

        io.observe(el);
        return () => io.disconnect();
    }, [hasMore, loadMore]);

    /** 관찰자가 못 도는 환경(구브라우저)·에러 복구용 수동 트리거 */
    const retry = useCallback(() => {
        setError(null);
        applyHasMore(true);
        void loadMore();
    }, [applyHasMore, loadMore]);

    return { items, hasMore, loading, error, loadMore, retry, sentinelRef };
}
