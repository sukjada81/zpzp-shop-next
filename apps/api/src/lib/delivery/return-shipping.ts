/**
 * 취소·반품·교환 배송비.
 * 출고 전 취소는 이 모듈을 타지 않는다(배송비 0, 전액 환불).
 * 변심 편도 = 출고지 설정 편도(+제주·도서). 조건부 무료여도 편도는 0이 아니다.
 */
import {
    computeHqDelivery,
    type HqDeliveryGoodsInput,
    type HqImAreasResolver,
    type HqShopDeliveryConfig,
} from "./hq-delivery.js";

export type ClaimCause = "change_of_mind" | "defect";
export type ClaimKind = "return" | "exchange";

export type ReturnShipExtras = {
    jeju: boolean;
    island: boolean;
    regionExtra: number;
};

export type ReturnShipQuote = {
    cause: ClaimCause;
    kind: ClaimKind;
    allowed: boolean;
    message: string;
    oneWay: number;
    roundTrip: number;
    emergingOutbound: number;
    buyerCharge: number;
    delivery2: number;
    prepaid: number;
    isFullVendorReturn: boolean;
    allCod: boolean;
};

function toInt(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function normalizeClaimCause(value: unknown): ClaimCause | null {
    const text = String(value ?? "").trim();
    if (text === "change_of_mind" || text === "변심") return "change_of_mind";
    if (text === "defect" || text === "하자") return "defect";
    return null;
}

export function parseClaimCause(reason: unknown): ClaimCause | "unknown" {
    const text = String(reason ?? "");
    if (/\[변심\]/.test(text) || /변심/.test(text)) return "change_of_mind";
    if (/\[하자\]/.test(text) || /하자|오배송|파손|불량/.test(text)) return "defect";
    return "unknown";
}

export function shopAreaExtras(shop: HqShopDeliveryConfig, extras: ReturnShipExtras): number {
    let fee = 0;
    if (extras.jeju && toInt(shop.imAreas1Used, 0) === 1) {
        fee += Math.max(0, toInt(shop.imAreas1Price, 0));
    }
    if (extras.island && toInt(shop.imAreas2Used, 0) === 1) {
        fee += Math.max(0, toInt(shop.imAreas2Price, 0));
    }
    fee += Math.max(0, toInt(extras.regionExtra, 0));
    return fee;
}

function goodsAreaExtras(
    line: Pick<HqDeliveryGoodsInput, "imAreas1Used" | "imAreas1Price" | "imAreas2Used" | "imAreas2Price">,
    extras: ReturnShipExtras
): number {
    let fee = 0;
    if (extras.jeju && toInt(line.imAreas1Used, 0) === 1) {
        fee += Math.max(0, toInt(line.imAreas1Price, 0));
    }
    if (extras.island && toInt(line.imAreas2Used, 0) === 1) {
        fee += Math.max(0, toInt(line.imAreas2Price, 0));
    }
    return fee;
}

/** 변심 편도. type1·2·3 은 설정 편도(+지역). type4·5 는 상품 개별. */
export function computePolicyOneWay(
    shop: HqShopDeliveryConfig,
    lines: HqDeliveryGoodsInput[],
    extras: ReturnShipExtras
): number {
    if (!lines.length) return 0;

    const feeBelow = Math.max(0, toInt(shop.feeBelow, 0));
    const sharedExtra = shopAreaExtras(shop, extras);
    let oneWay = 0;
    let hasShared = false;
    const type4Seen = new Set<number>();
    const type5Seen = new Set<number>();

    for (const line of lines) {
        const type = toInt(line.deliveryType, 1);
        const qty = Math.max(0, toInt(line.qty, 0));
        const unit = Math.max(0, toInt(line.deliveryPrice, 0));
        const typeQty = Math.max(1, toInt(line.deliveryTypeQty, 1));
        const pid = toInt(line.productId, 0);
        const goodsExtra = goodsAreaExtras(line, extras);

        if (type === 4) {
            if (type4Seen.has(pid)) continue;
            type4Seen.add(pid);
            oneWay += unit + goodsExtra;
            continue;
        }
        if (type === 5) {
            if (line.hasOption && type5Seen.has(pid)) continue;
            type5Seen.add(pid);
            const scale = Math.ceil(Math.max(qty, 1) / typeQty);
            oneWay += (unit + goodsExtra) * scale;
            continue;
        }
        if (type === 1 || type === 2 || type === 3) {
            hasShared = true;
        }
    }

    if (hasShared) {
        oneWay += feeBelow + sharedExtra;
    }

    return Math.max(0, oneWay);
}

function isAllCod(lines: HqDeliveryGoodsInput[]): boolean {
    return lines.length > 0 && lines.every((line) => toInt(line.deliveryType, 1) === 3);
}

function extrasResolver(extras: ReturnShipExtras): HqImAreasResolver {
    return {
        isIslandExtra: () => extras.island,
        regionExtra: () => Math.max(0, toInt(extras.regionExtra, 0)),
    };
}

export function computeEmergingOutbound(input: {
    shop: HqShopDeliveryConfig;
    remaining: HqDeliveryGoodsInput[];
    paidDelivery: number;
    extras: ReturnShipExtras;
    address1?: string;
    postcode?: string;
}): number {
    if (!input.remaining.length) return 0;
    const address1 = input.extras.jeju
        ? `${input.address1 || ""} 제주특별자치도`.trim()
        : input.address1;
    const after = computeHqDelivery(
        input.shop,
        input.remaining,
        { address1, postcode: input.postcode },
        extrasResolver(input.extras)
    ).total;
    return Math.max(0, after - Math.max(0, toInt(input.paidDelivery, 0)));
}

export function computeReturnShipping(input: {
    cause: ClaimCause;
    kind: ClaimKind;
    shop: HqShopDeliveryConfig;
    returning: HqDeliveryGoodsInput[];
    remaining: HqDeliveryGoodsInput[];
    extras: ReturnShipExtras;
    paidDelivery: number;
    changeOfMindExchangeCount?: number;
    address1?: string;
    postcode?: string;
}): ReturnShipQuote {
    const oneWay = computePolicyOneWay(input.shop, input.returning, input.extras);
    const roundTrip = oneWay * 2;
    const isFullVendorReturn = input.remaining.length === 0;
    const allCod = isAllCod(input.returning);
    const emergingOutbound = isFullVendorReturn
        ? 0
        : computeEmergingOutbound({
              shop: input.shop,
              remaining: input.remaining,
              paidDelivery: input.paidDelivery,
              extras: input.extras,
              address1: input.address1,
              postcode: input.postcode,
          });

    const base: ReturnShipQuote = {
        cause: input.cause,
        kind: input.kind,
        allowed: true,
        message: "",
        oneWay,
        roundTrip,
        emergingOutbound,
        buyerCharge: 0,
        delivery2: 0,
        prepaid: 0,
        isFullVendorReturn,
        allCod,
    };

    if (input.cause === "defect") {
        return {
            ...base,
            message: "하자·오배송·파손은 구매자 배송비 0원입니다. 왕복은 공급사가 부담합니다.",
        };
    }

    if (input.kind === "exchange") {
        const used = Math.max(0, toInt(input.changeOfMindExchangeCount, 0));
        if (used >= 1) {
            return {
                ...base,
                allowed: false,
                message: "변심 교환은 1회만 가능합니다. 반품하거나 새로 주문해 주세요.",
            };
        }
        return {
            ...base,
            buyerCharge: roundTrip,
            prepaid: roundTrip,
            message: `변심 교환 왕복 ${roundTrip.toLocaleString()}원을 선결제해야 재발송됩니다.`,
        };
    }

    const returnLeg = oneWay;
    const delivery2 = isFullVendorReturn
        ? allCod
            ? returnLeg
            : roundTrip
        : emergingOutbound + returnLeg;

    return {
        ...base,
        buyerCharge: delivery2,
        delivery2,
        message: isFullVendorReturn
            ? allCod
                ? `착불 초도는 이미 내셨습니다. 변심 회수 편도 ${returnLeg.toLocaleString()}원을 환불금에서 차감합니다.`
                : `변심 반품 왕복 ${roundTrip.toLocaleString()}원(편도 ${oneWay.toLocaleString()}×2)을 환불금에서 차감합니다.`
            : `변심 부분반품: 회수 ${returnLeg.toLocaleString()}원` +
              (emergingOutbound > 0
                  ? ` + 남은 주문 초도 ${emergingOutbound.toLocaleString()}원`
                  : "") +
              ` = ${delivery2.toLocaleString()}원`,
    };
}

export function formatClaimReason(
    cause: ClaimCause,
    kind: ClaimKind,
    quote: Pick<ReturnShipQuote, "oneWay" | "buyerCharge" | "prepaid">,
    extra = ""
): string {
    const tag = cause === "defect" ? "[하자]" : "[변심]";
    const label = kind === "exchange" ? "교환" : "반품";
    const amount = cause === "defect" ? 0 : kind === "exchange" ? quote.prepaid : quote.buyerCharge;
    const body = `${tag} ${label} 편도${quote.oneWay} 차감${amount}`;
    const note = String(extra ?? "").trim();
    const text = note ? `${body} ${note}` : body;
    return text.slice(0, 100);
}

export function refundAfterShipping(input: {
    goodsRefund: number;
    includePaidDelivery: boolean;
    paidDelivery: number;
    delivery2: number;
}): { netRefund: number; depositDue: number } {
    const goods = Math.max(0, toInt(input.goodsRefund, 0));
    const paid = input.includePaidDelivery ? Math.max(0, toInt(input.paidDelivery, 0)) : 0;
    const charge = Math.max(0, toInt(input.delivery2, 0));
    const raw = goods + paid - charge;
    return {
        netRefund: Math.max(0, raw),
        depositDue: Math.max(0, -raw),
    };
}
