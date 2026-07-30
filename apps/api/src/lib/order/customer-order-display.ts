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
    canConfirm: boolean;
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

/** 배송완료(4) + status2 없을 때 구매확정 — shop-php order_list.php is_btn_confirmation */
export function canCustomerConfirmPurchase(goodsStatus: number, goodsStatus2: number): boolean {
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
    const canConfirm = canCustomerConfirmPurchase(input.goodsStatus, input.goodsStatus2);

    return {
        canCancel,
        canReturn: canClaim,
        canExchange: canClaim,
        canConfirm,
        cancelMode,
        isOnlinePrepaid: online,
    };
}

export type CustomerOrderItemInput = {
    status: number;
    status2: number;
    payType: string;
    payStatus: string;
    payInfo: string;
    /** 주문 내 상품 총 건수 (shop-php: mallRN_order_goods count) */
    orderItemCount: number;
    /** 주문 status_date (unix) — 당일 계좌이체 즉시취소 판별용 */
    orderStatusDate?: number;
};

export type CustomerOrderItemActions = {
    canCancelImmediate: boolean;
    canCancelRequest: boolean;
    canWithdrawCancelRequest: boolean;
    canConfirm: boolean;
    canReturn: boolean;
    canExchange: boolean;
    canWithdrawClaimRequest: boolean;
    cancelMode: "immediate" | "request" | "none";
    effectiveStatus: number;
    statusLabel: string;
    displayStatus: string;
};

function buildCustomerOrderItemActions(input: {
    status: number;
    status2: number;
    statusLabel: string;
    cancelImmediate?: boolean;
    cancelRequest?: boolean;
    withdrawCancel?: boolean;
    confirm?: boolean;
    returnClaim?: boolean;
    exchangeClaim?: boolean;
    withdrawClaim?: boolean;
    cancelMode?: CustomerOrderItemActions["cancelMode"];
}): CustomerOrderItemActions {
    return {
        canCancelImmediate: Boolean(input.cancelImmediate),
        canCancelRequest: Boolean(input.cancelRequest),
        canWithdrawCancelRequest: Boolean(input.withdrawCancel),
        canConfirm: Boolean(input.confirm),
        canReturn: Boolean(input.returnClaim),
        canExchange: Boolean(input.exchangeClaim),
        canWithdrawClaimRequest: Boolean(input.withdrawClaim),
        cancelMode: input.cancelMode ?? "none",
        effectiveStatus: input.status,
        statusLabel: input.statusLabel,
        displayStatus: input.statusLabel,
    };
}

/** shop-php order_list.php status_function — 상품 1건 기준 */
export function resolveCustomerOrderItemActions(
    input: CustomerOrderItemInput
): CustomerOrderItemActions {
    const payType = normalizePayType(input.payType);
    const payStatus = normalizePayStatus(input.payStatus);
    const payInfo = String(input.payInfo ?? "");
    const status = resolveEffectiveGoodsStatus(
        Number.isFinite(input.status) ? Math.trunc(input.status) : 0,
        payStatus
    );
    const status2 =
        input.status2 != null && Number.isFinite(input.status2) ? Math.trunc(input.status2) : 0;
    const orderItemCount = Math.max(0, Math.trunc(input.orderItemCount || 0));
    const statusLabel = buildGoodsStatusLabel(status, status2);

    if (status === 9) {
        return buildCustomerOrderItemActions({
            status,
            status2,
            statusLabel,
            withdrawCancel: status2 === 1,
        });
    }

    if (status2 === 1 && (status === 7 || status === 8)) {
        return buildCustomerOrderItemActions({
            status,
            status2,
            statusLabel,
            withdrawClaim: true,
        });
    }

    if (status === 0) {
        return buildCustomerOrderItemActions({
            status,
            status2,
            statusLabel,
            cancelImmediate: true,
            cancelMode: "immediate",
        });
    }

    const isToss =
        payInfo.toUpperCase().startsWith("TOSS|") ||
        payInfo.toUpperCase().startsWith("TOSS:") ||
        payInfo.toUpperCase() === "TOSS";
    const statusDate = input.orderStatusDate ?? 0;
    const isSameDayTransfer =
        payType === "R" &&
        statusDate > 0 &&
        new Date(statusDate * 1000).toDateString() === new Date().toDateString();

    const prepaidImmediatePath =
        payType === "M" ||
        payType === "C" ||
        isToss ||
        isSameDayTransfer ||
        isOnlinePrepaidOrder(payType, payStatus, payInfo);

    if (status === 1) {
        if (prepaidImmediatePath && orderItemCount === 1) {
            return buildCustomerOrderItemActions({
                status,
                status2,
                statusLabel,
                cancelImmediate: true,
                cancelMode: "immediate",
            });
        }
        return buildCustomerOrderItemActions({
            status,
            status2,
            statusLabel,
            cancelRequest: true,
            cancelMode: "request",
        });
    }

    if (status === 2) {
        return buildCustomerOrderItemActions({
            status,
            status2,
            statusLabel,
            cancelRequest: true,
            cancelMode: "request",
        });
    }

    if (status === 3 || status === 4) {
        const canClaim = canCustomerReturnOrExchange(status, status2);
        return buildCustomerOrderItemActions({
            status,
            status2,
            statusLabel,
            confirm: canCustomerConfirmPurchase(status, status2),
            returnClaim: canClaim,
            exchangeClaim: canClaim,
        });
    }

    return buildCustomerOrderItemActions({ status, status2, statusLabel });
}

export type OrderGoodsAggregate = {
    goodsStatus: number;
    goodsStatus2: number;
    isPartiallyCanceled: boolean;
    activeCount: number;
    canceledCount: number;
    totalCount: number;
};

/** 주문 전체 대표 상태 — 부분취소 시 집계 */
export function resolveOrderGoodsAggregate(
    items: Array<{ status: number; status2: number }>,
    payStatus: string
): OrderGoodsAggregate {
    if (!items.length) {
        return {
            goodsStatus: 0,
            goodsStatus2: 0,
            isPartiallyCanceled: false,
            activeCount: 0,
            canceledCount: 0,
            totalCount: 0,
        };
    }

    const normalized = items.map((item) => ({
        status: resolveEffectiveGoodsStatus(toIntStatus(item.status), payStatus),
        status2: toIntStatus(item.status2),
    }));

    const canceledCount = normalized.filter((row) => row.status === 9).length;
    const active = normalized.filter((row) => row.status !== 9);
    const activeCount = active.length;
    const rep = active[0] ?? normalized[0];

    return {
        goodsStatus: rep.status,
        goodsStatus2: rep.status2,
        isPartiallyCanceled: canceledCount > 0 && activeCount > 0,
        activeCount,
        canceledCount,
        totalCount: items.length,
    };
}

function toIntStatus(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
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

export function applyPartialCancelDisplay(
    display: CustomerOrderDisplay,
    aggregate: OrderGoodsAggregate
): CustomerOrderDisplay {
    if (!aggregate.isPartiallyCanceled) return display;

    const partialLabel = `부분취소 (${aggregate.activeCount}/${aggregate.totalCount})`;
    const mixedStatusLabel = `${partialLabel} · ${display.statusLabel}`;

    return {
        ...display,
        displayStatus: mixedStatusLabel,
        badgeText: partialLabel,
        footerText: "일부 상품이 취소되었습니다.",
        canCancel: aggregate.activeCount > 0 && display.canCancel,
    };
}
