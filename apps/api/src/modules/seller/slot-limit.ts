/** 등급 슬롯 수 0은 무제한. 1 이상은 그 개수만큼만 새 상품을 등록할 수 있다. */

export function isUnlimitedSlot(slotLimit: number): boolean {
    return slotLimit === 0;
}

export function slotExceededCount(slotLimit: number, slotUsed: number): number {
    if (isUnlimitedSlot(slotLimit)) return 0;
    return Math.max(0, slotUsed - slotLimit);
}

export function isSlotRegistrationBlocked(slotLimit: number, slotUsed: number): boolean {
    if (isUnlimitedSlot(slotLimit)) return false;
    return slotUsed >= slotLimit;
}

/** 추가 등록이 막히면 사유 코드. 무제한이거나 넣을 수 있으면 null. */
export function slotRegistrationBlockCode(
    slotLimit: number,
    usedBefore: number,
    adding: number,
): "SLOT_EXCEEDED" | "SLOT_SHORTAGE" | null {
    if (isUnlimitedSlot(slotLimit)) return null;
    if (usedBefore > slotLimit) return "SLOT_EXCEEDED";
    if (adding > 0 && usedBefore + adding > slotLimit) return "SLOT_SHORTAGE";
    return null;
}
