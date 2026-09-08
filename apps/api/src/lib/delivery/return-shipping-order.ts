import type { PrismaClient } from "@prisma/client";
import type { HqDeliveryGoodsInput, HqShopDeliveryConfig } from "./hq-delivery.js";
import {
    computeReturnShipping,
    formatClaimReason,
    parseClaimCause,
    refundAfterShipping,
    type ClaimCause,
    type ClaimKind,
    type ReturnShipExtras,
    type ReturnShipQuote,
} from "./return-shipping.js";

function toInt(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toSafeString(value: unknown, fallback = ""): string {
    const text = String(value ?? "").trim();
    return text || fallback;
}

function isActiveGoods(status: number, status2: number): boolean {
    if ((status === 8 || status === 9) && status2 === 5) return false;
    return true;
}

async function loadShop(prisma: PrismaClient): Promise<HqShopDeliveryConfig> {
    const conf = await prisma.mallRN_configuration.findUnique({
        where: { uid: 1 },
        select: {
            delivery_type: true,
            delivery_p_price1: true,
            delivery_p_price2: true,
            delivery_im_areas1_used: true,
            delivery_im_areas1_price: true,
            delivery_im_areas2_used: true,
            delivery_im_areas2_price: true,
        },
    });
    return {
        deliveryType: String(conf?.delivery_type ?? "P"),
        freeThreshold: toInt(conf?.delivery_p_price1, 0),
        feeBelow: toInt(conf?.delivery_p_price2, 0),
        imAreas1Used: toInt(conf?.delivery_im_areas1_used, 0),
        imAreas1Price: toInt(conf?.delivery_im_areas1_price, 0),
        imAreas2Used: toInt(conf?.delivery_im_areas2_used, 0),
        imAreas2Price: toInt(conf?.delivery_im_areas2_price, 0),
    };
}

async function resolveExtras(
    prisma: PrismaClient,
    address1: string,
    postcode: string
): Promise<ReturnShipExtras> {
    const jeju = /제주/i.test(address1);
    let island = false;
    let regionExtra = 0;
    const pc = String(postcode ?? "").trim();
    if (pc) {
        const areaRows = await prisma.mallRN_im_areas.findMany({
            where: { postcode: pc, OR: [{ base: 0 }, { base: 1, vendor: "" }] },
            select: { uid: true },
        });
        if (areaRows.length) {
            const exceptRows = await prisma.mallRN_im_areas_except.findMany({
                where: { vendor: "", p_uid: { in: areaRows.map((r) => r.uid) } },
                select: { p_uid: true },
            });
            const excepted = new Set(exceptRows.map((r) => r.p_uid));
            island = areaRows.some((r) => !excepted.has(r.uid));
        }
    }
    const regionRows = await prisma.mallRN_delivery_configuration.findMany({
        where: { vendor: "", used: 1 },
        orderBy: { uid: "asc" },
        select: { title: true, price: true },
    });
    for (const row of regionRows) {
        const title = String(row.title ?? "").trim();
        if (!title) continue;
        try {
            if (new RegExp(title, "i").test(address1)) {
                regionExtra = Math.max(0, toInt(row.price, 0));
                break;
            }
        } catch {
            if (address1.toLowerCase().includes(title.toLowerCase())) {
                regionExtra = Math.max(0, toInt(row.price, 0));
                break;
            }
        }
    }
    return { jeju, island, regionExtra };
}

type GoodsRow = {
    uid: number;
    g_uid: number;
    qty: number;
    price: number;
    option: number;
    delivery_type: number;
    delivery_price: number;
    delivery_type_qty: number;
    status: number;
    status2: number;
    vendor_delivery: string;
};

async function toHqLine(prisma: PrismaClient, row: GoodsRow): Promise<HqDeliveryGoodsInput> {
    const product = await prisma.mallRN_goods.findUnique({
        where: { uid: row.g_uid },
        select: {
            delivery_im_areas1_used: true,
            delivery_im_areas1_price: true,
            delivery_im_areas2_used: true,
            delivery_im_areas2_price: true,
        },
    });
    return {
        productId: toInt(row.g_uid, 0),
        qty: Math.max(0, toInt(row.qty, 0)),
        hasOption: toInt(row.option, 0) > 0,
        price: toInt(row.price, 0),
        deliveryType: toInt(row.delivery_type, 1),
        deliveryPrice: toInt(row.delivery_price, 0),
        deliveryTypeQty: Math.max(1, toInt(row.delivery_type_qty, 1)),
        imAreas1Used: toInt(product?.delivery_im_areas1_used, 0),
        imAreas1Price: toInt(product?.delivery_im_areas1_price, 0),
        imAreas2Used: toInt(product?.delivery_im_areas2_used, 0),
        imAreas2Price: toInt(product?.delivery_im_areas2_price, 0),
    };
}

export type OrderReturnShipQuote = ReturnShipQuote & {
    goodsRefund: number;
    paidDelivery: number;
    includePaidDelivery: boolean;
    netRefund: number;
    depositDue: number;
    reasonText: string;
};

export function isReturnShipQuoteError(
    quote: OrderReturnShipQuote | { ok: false; message: string }
): quote is { ok: false; message: string } {
    return "ok" in quote && quote.ok === false;
}

export async function quoteOrderItemReturnShipping(input: {
    prisma: PrismaClient;
    tenantId: bigint;
    orderNum: string;
    orderGoodsUid: number;
    cause: ClaimCause;
    kind: ClaimKind;
    /** 함께 반품하는 다른 품목 — 남은 주문 초도 계산에서 제외 */
    alsoReturningUids?: number[];
}): Promise<OrderReturnShipQuote | { ok: false; message: string }> {
    const { prisma, tenantId, orderNum, orderGoodsUid, cause, kind } = input;

    const info = await prisma.mallRN_order_info.findFirst({
        where: { tenant_id: tenantId, platform_type: "DAD", order_num: orderNum, reals: 1 },
        select: { delivery_total: true, address1: true, postcode: true },
    });
    if (!info) return { ok: false, message: "주문을 찾을 수 없습니다." };

    const goods = await prisma.mallRN_order_goods.findMany({
        where: { tenant_id: tenantId, platform_type: "DAD", order_num: orderNum, reals: 1 },
        select: {
            uid: true,
            g_uid: true,
            qty: true,
            price: true,
            option: true,
            delivery_type: true,
            delivery_price: true,
            delivery_type_qty: true,
            status: true,
            status2: true,
            vendor_delivery: true,
        },
    });
    const target = goods.find((row) => Number(row.uid) === orderGoodsUid);
    if (!target) return { ok: false, message: "주문상품을 찾을 수 없습니다." };

    const shop = await loadShop(prisma);
    const extras = await resolveExtras(prisma, toSafeString(info.address1, ""), toSafeString(info.postcode, ""));
    const extraReturning = new Set((input.alsoReturningUids ?? []).map((uid) => Number(uid)));
    const returning = [await toHqLine(prisma, target as GoodsRow)];
    for (const row of goods) {
        if (!extraReturning.has(Number(row.uid))) continue;
        returning.push(await toHqLine(prisma, row as GoodsRow));
    }
    const remainingRows = goods.filter(
        (row) =>
            Number(row.uid) !== orderGoodsUid &&
            !extraReturning.has(Number(row.uid)) &&
            isActiveGoods(toInt(row.status, 0), toInt(row.status2, 0)) &&
            toSafeString(row.vendor_delivery, "") === toSafeString(target.vendor_delivery, "")
    );
    const remaining: HqDeliveryGoodsInput[] = [];
    for (const row of remainingRows) remaining.push(await toHqLine(prisma, row as GoodsRow));

    let paidDelivery = toInt(info.delivery_total, 0);
    const vendorDelivery = await prisma.mallRN_order_delivery.findFirst({
        where: { order_num: orderNum, vendor: toSafeString(target.vendor_delivery, "") },
        select: { price: true },
    });
    if (vendorDelivery) paidDelivery = toInt(vendorDelivery.price, paidDelivery);

    let changeOfMindExchangeCount = 0;
    if (kind === "exchange" && cause === "change_of_mind") {
        const prev = await prisma.mallRN_order_status_change.findMany({
            where: { order_num: orderNum, og_uid: orderGoodsUid, status: 7 },
            select: { reason: true },
        });
        changeOfMindExchangeCount = prev.filter((row) => parseClaimCause(row.reason) === "change_of_mind").length;
    }

    const quote = computeReturnShipping({
        cause,
        kind,
        shop,
        returning,
        remaining,
        extras,
        paidDelivery,
        changeOfMindExchangeCount,
        address1: toSafeString(info.address1, ""),
        postcode: toSafeString(info.postcode, ""),
    });

    const returningRows = [
        target,
        ...goods.filter((row) => extraReturning.has(Number(row.uid))),
    ];
    const goodsRefund = returningRows.reduce(
        (sum, row) => sum + toInt(row.price, 0) * Math.max(0, toInt(row.qty, 0)),
        0
    );
    const includePaidDelivery = remaining.length === 0;
    const settle = refundAfterShipping({
        goodsRefund,
        includePaidDelivery,
        paidDelivery,
        delivery2: quote.delivery2,
    });

    return {
        ...quote,
        goodsRefund,
        paidDelivery,
        includePaidDelivery,
        netRefund: kind === "exchange" ? 0 : settle.netRefund,
        depositDue: kind === "exchange" ? 0 : settle.depositDue,
        reasonText: formatClaimReason(cause, kind, quote),
    };
}

/** 미리보기 응답용 */
export function serializeReturnShipQuote(quote: OrderReturnShipQuote) {
    return {
        cause: quote.cause,
        kind: quote.kind,
        allowed: quote.allowed,
        message: quote.message,
        oneWay: quote.oneWay,
        roundTrip: quote.roundTrip,
        emergingOutbound: quote.emergingOutbound,
        buyerCharge: quote.buyerCharge,
        delivery2: quote.delivery2,
        prepaid: quote.prepaid,
        goodsRefund: quote.goodsRefund,
        netRefund: quote.netRefund,
        depositDue: quote.depositDue,
        isFullVendorReturn: quote.isFullVendorReturn,
        allCod: quote.allCod,
        reasonText: quote.reasonText,
    };
}
