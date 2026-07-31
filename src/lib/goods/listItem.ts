// src/lib/goods/listItem.ts
import type { GoodsListItem } from "@/components/goods/GoodsListClient";
import type { PublicProductListItem } from "@/lib/types/goods";

/**
 * 상품 목록 API 응답 → 카드용 아이템 매퍼.
 *
 * 홈(전체 상품 그리드)·/goods 목록·무한 스크롤 추가 로드분이 모두 이 함수를 쓴다.
 * 특히 **비회원 마스킹(§8)** 규칙을 한 곳에만 두기 위해 공용화했다 —
 * price 의 null 을 0 으로 접으면 안 되고(그래야 "회원가"으로 표시),
 * masked 는 서버 플래그를 우선하되 없으면 price==null 로 판정한다.
 * 추가 로드분에서 이 규칙이 빠지면 비회원에게 실판매가가 새는 경로가 된다.
 */
export function toGoodsListItem(p: PublicProductListItem): GoodsListItem {
    return {
        id: String(p.id ?? ""),
        title: String(p.title ?? ""),
        // 비회원 마스킹(§8): null을 0으로 접지 말 것 — null이어야 "회원가"으로 표시된다
        price: p.price == null ? null : Number(p.price),
        masked: p.masked ?? p.price == null,
        badgeLeft: undefined,
        badgeRight: undefined,
        metaLeft: p.metaLeft,
        metaRight: p.metaRight,
        thumbnailUrl: p.thumbnailUrl,
        cate: p.cate ?? null,
        categoryLabel: p.categoryLabel ?? undefined,
    };
}

export function toGoodsListItems(items?: PublicProductListItem[] | null): GoodsListItem[] {
    return (items ?? []).map(toGoodsListItem);
}
