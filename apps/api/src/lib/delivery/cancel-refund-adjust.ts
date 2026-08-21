/**
 * 부분 취소 시 「무료→조건부 배송비 발생」 만큼 환불액에서 차감.
 * 본사 관리자 취소의 delivery2 와 같은 개념 (shop-php 미수정, Next 전용).
 */
export function emergingDeliveryOnCancel(input: {
    deliveryBefore: number;
    deliveryAfter: number;
}): number {
    const before = Math.max(0, Math.trunc(Number(input.deliveryBefore) || 0));
    const after = Math.max(0, Math.trunc(Number(input.deliveryAfter) || 0));
    return Math.max(0, after - before);
}

/** 실환불액 = 상품취소액 − 신규 발생 배송비 */
export function refundAmountAfterDeliveryAdjust(input: {
    lineAmount: number;
    emergingDelivery: number;
}): number {
    const line = Math.max(0, Math.trunc(Number(input.lineAmount) || 0));
    const emerging = Math.max(0, Math.trunc(Number(input.emergingDelivery) || 0));
    return Math.max(0, line - emerging);
}
