/**
 * 고객 주문 UI — shop-php order_list.php / order_detail.php 상태 규칙.
 */

export const GOODS_STATUS_LABELS: Record<number, string> = {
    0: "입금대기중",
    1: "결제완료",
    2: "배송준비중",
    3: "배송중",
    4: "배송완료",
    5: "구매확정",
    7: "교환",
    8: "반품",
    9: "취소",
};

export const GOODS_STATUS2_LABELS: Record<number, string> = {
    1: "요청",
    2: "중",
    3: "회수완료",
    4: "발송완료",
    5: "완료",
};

export type CustomerOrderDisplayInput = {
    goodsStatus: number;
    goodsStatus2?: number;
    payType?: string;
    payStatus?: string;
    payInfo?: string;
    payMethod?: string;
    pickupAt?: Date | string | null;
};

export type CustomerOrderActions = {
    canCancel: boolean;
    canReturn: boolean;
    canExchange: boolean;
    cancelMode: "immediate" | "request" | "none";
    isOnlinePrepaid: boolean;
};

export type CustomerOrderDisplay = CustomerOrderActions & {
    goodsStatus: number;
    goodsStatus2: number;
    effectiveGoodsStatus: number;
    statusLabel: string;
    displayStatus: string;
    payType: string;
    payStatus: string;
    payTypeLabel: string;
    payStatusLabel: string;
    footerText: string | null;
    badgeText: string | null;
};

function normalizePayType(value: unknown): string {
    return String(value ?? "B").trim().toUpperCase() || "B";
}

function normalizePayStatus(value: unknown): string {
    return String(value ?? "A").trim().toUpperCase() || "A";
}

export function isOnlinePrepaidOrder(payType: string, payStatus: string, payInfo: string): boolean {
    const info = String(payInfo ?? "").toUpperCase();
    if (payStatus === "C" && (payType === "C" || info.includes("TOSS"))) return true;
    if (info.startsWith("TOSS|") || info.startsWith("TOSS:")) return true;
    return false;
}

export function resolveEffectiveGoodsStatus(goodsStatus: number, payStatus: string): number {
    if (goodsStatus === 0 && payStatus === "C") return 1;
    return goodsStatus;
}

export function buildGoodsStatusLabel(status: number, status2: number): string {
    const base = GOODS_STATUS_LABELS[status] ?? `상태(${status})`;
    if (status2 > 0) {
        const sub = GOODS_STATUS2_LABELS[status2] ?? "";
        if (sub) return `${base}${sub}`;
    }
    return base;
}

function resolvePayTypeLabel(payType: string, payInfo: string, payMethod: string): string {
    if (isOnlinePrepaidOrder(payType, "C", payInfo)) return "온라인 결제";

    const info = String(payInfo ?? "").toUpperCase();
    if (info.startsWith("TOSS|")) {
        const method = String(payMethod ?? "").trim();
        if (method) return `온라인 결제 (${method})`;
        return "온라인 결제";
    }

    switch (payType) {
        case "B":
            return "무통장입금";
        case "C":
            return "카드";
        case "R":
            return "계좌이체";
        case "V":
            return "가상계좌";
        case "H":
            return "휴대폰";
        case "M":
            return "마일리지";
        default:
            return payType || "-";
    }
}

function resolvePayStatusLabel(payStatus: string, payType: string): string {
    switch (payStatus) {
        case "C":
            return "결제완료";
        case "D":
            return "결제실패";
        case "B":
            return payType === "V" ? "가상계좌 발급" : "입금대기";
        case "A":
        default:
            return "입금대기";
    }
}

function buildFooterText(input: {
    effectiveStatus: number;
    status2: number;
    payStatus: string;
    isOnlinePrepaid: boolean;
    hasPickupAt: boolean;
}): string | null {
    const { effectiveStatus, status2, payStatus, isOnlinePrepaid, hasPickupAt } = input;

    if (effectiveStatus === 9) return "주문이 취소되었습니다.";
    if (status2 > 0 && (effectiveStatus === 7 || effectiveStatus === 8)) {
        return "교환·반품 처리가 진행 중입니다.";
    }

    if (hasPickupAt && !isOnlinePrepaid) {
        return "매장 방문 시 수령 가능";
    }

    switch (effectiveStatus) {
        case 0:
            return payStatus === "C" ? "결제가 완료되었습니다." : "입금 확인 후 배송이 시작됩니다.";
        case 1:
            return "결제가 완료되었습니다.";
        case 2:
            return "상품 준비 중입니다.";
        case 3:
            return "배송 중입니다.";
        case 4:
            return "배송이 완료되었습니다.";
        case 5:
            return "구매가 확정되었습니다.";
        case 7:
            return "교환 처리 중입니다.";
        case 8:
            return "반품 처리 중입니다.";
        default:
            return isOnlinePrepaid ? "결제가 완료되었습니다." : "주문이 접수되었습니다.";
    }
}

/** 배송준비중(2) 이상이면 취소 불가 — shop-php 고객 즉시취소는 status 0~1 */
export function canCustomerCancelOrder(goodsStatus: number): boolean {
    if (goodsStatus >= 2) return false;
    if (goodsStatus === 9) return false;
    return true;
}

/** 배송완료(4) + 진행 중 status2 없을 때만 반품/교환 요청 */
export function canCustomerReturnOrExchange(goodsStatus: number, goodsStatus2: number): boolean {
    return goodsStatus === 4 && goodsStatus2 === 0;
}

export function resolveCustomerOrderActions(input: {
    goodsStatus: number;
    goodsStatus2: number;
    payType: string;
    payStatus: string;
    payInfo: string;
}): CustomerOrderActions {
    const online = isOnlinePrepaidOrder(input.payType, input.payStatus, input.payInfo);
    const canCancel = canCustomerCancelOrder(input.goodsStatus);

    // 배송준비(2) 전까지는 토스 포함 즉시 취소 — PG 취소는 API에서 선행 처리
    const cancelMode: CustomerOrderActions["cancelMode"] = canCancel ? "immediate" : "none";

    const canClaim = canCustomerReturnOrExchange(input.goodsStatus, input.goodsStatus2);

    return {
        canCancel,
        canReturn: canClaim,
        canExchange: canClaim,
        cancelMode,
        isOnlinePrepaid: online,
    };
}

export function resolveCustomerOrderDisplay(input: CustomerOrderDisplayInput): CustomerOrderDisplay {
    const goodsStatus = Number.isFinite(input.goodsStatus) ? Math.trunc(input.goodsStatus) : 0;
    const goodsStatus2 =
        input.goodsStatus2 != null && Number.isFinite(input.goodsStatus2)
            ? Math.trunc(input.goodsStatus2)
            : 0;
    const payType = normalizePayType(input.payType);
    const payStatus = normalizePayStatus(input.payStatus);
    const payInfo = String(input.payInfo ?? "");
    const payMethod = String(input.payMethod ?? "");
    const hasPickupAt = !!input.pickupAt;

    const effectiveGoodsStatus = resolveEffectiveGoodsStatus(goodsStatus, payStatus);
    const statusLabel = buildGoodsStatusLabel(effectiveGoodsStatus, goodsStatus2);
    const actions = resolveCustomerOrderActions({
        goodsStatus: effectiveGoodsStatus,
        goodsStatus2,
        payType,
        payStatus,
        payInfo,
    });

    const footerText = buildFooterText({
        effectiveStatus: effectiveGoodsStatus,
        status2: goodsStatus2,
        payStatus,
        isOnlinePrepaid: actions.isOnlinePrepaid,
        hasPickupAt,
    });

    let badgeText: string | null = null;
    if (effectiveGoodsStatus === 0 && payStatus !== "C") {
        badgeText = "입금대기";
    } else if (payStatus === "C" && effectiveGoodsStatus >= 1 && effectiveGoodsStatus <= 4) {
        badgeText = statusLabel;
    }

    return {
        ...actions,
        goodsStatus,
        goodsStatus2,
        effectiveGoodsStatus,
        statusLabel,
        displayStatus: statusLabel,
        payType,
        payStatus,
        payTypeLabel: resolvePayTypeLabel(payType, payInfo, payMethod),
        payStatusLabel: resolvePayStatusLabel(payStatus, payType),
        footerText,
        badgeText,
    };
}
