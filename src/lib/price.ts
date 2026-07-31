// src/lib/price.ts
// 비회원 가격 마스킹 표시 (기획서 §8 — 비회원 가격 노출 차단)
// 서버(apps/api public/products)가 비로그인 요청에 price=null + masked=true 로 내려주므로,
// 진열가(상품 목록/상세/홈 카드)의 "원" 표기는 이 헬퍼로 통일한다.
// 결제금액(체크아웃/주문내역)은 이 헬퍼 대상이 아니다 — 선결제/PG 금액과 어긋나지 않도록 제외.
//
// 표시 문구는 이 상수 하나만 바꾸면 전 노출 지점(GoodsCard/GoodsListClient/GoodsDetailClient
// 본가·옵션·합계/OngoingGroupBuySection 단가·합계)에 함께 반영된다. 서버 마스킹(price=null)은
// 문구와 무관하게 그대로다 — 문구만 바꾸는 변경이 실가 노출로 이어지지 않는다.
export const MASKED_PRICE_TEXT = "회원가";

/** 비회원 마스킹 여부: 서버 masked 플래그가 켜졌거나 실판매가가 미전송(null)된 경우 */
export function isMaskedPrice(value: number | null | undefined, masked?: boolean): boolean {
    return masked === true || value == null;
}

/** 진열가 표시: 마스킹이면 "회원가", 아니면 "12,000원" */
export function formatDisplayPrice(value: number | null | undefined, masked?: boolean): string {
    if (isMaskedPrice(value, masked)) return MASKED_PRICE_TEXT;
    return `${Number(value).toLocaleString()}원`;
}
