/**
 * 본사 배송비 — shop-php php/order_post_toss.php (vendor_delivery='' 본사 경로)
 *
 * 상품 delivery_type:
 *   1 조건부(설정 P: 미만이면 delivery_p_price2)
 *   2 무료배송(조건부 무효)
 *   3 착불(선불 0, 상품 도서산간만 가능)
 *   4 고정 개별배송비(동일 g_uid 1회)
 *   5 수량당 개별배송비(ceil(qty/delivery_type_qty), 옵션은 g_uid 합산 1회)
 *
 * type1 은 mallRN_goods.delivery_price 를 쓰지 않는다.
 * 원복: 이 파일 + delivery.routes + order/prepare 연동.
 */
import type { PrismaClient } from "@prisma/client";

function toInt(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export type HqShopDeliveryConfig = {
    /** P | F | D */
    deliveryType: string;
    freeThreshold: number;
    feeBelow: number;
    imAreas1Used: number;
    imAreas1Price: number;
    imAreas2Used: number;
    imAreas2Price: number;
};

export type HqDeliveryGoodsInput = {
    productId: number;
    qty: number;
    /** 옵션 라인 여부(optionId 있음) — type5 합산용 */
    hasOption: boolean;
    price: number;
    deliveryType: number;
    deliveryPrice: number;
    deliveryTypeQty: number;
    imAreas1Used: number;
    imAreas1Price: number;
    imAreas2Used: number;
    imAreas2Price: number;
};

export type HqDeliveryAddress = {
    address1?: string;
    postcode?: string;
};

export type HqImAreasResolver = {
    /** 제주 외 도서: mallRN_im_areas 매칭 + except 없음 */
    isIslandExtra: (postcode: string, vendor: string) => boolean;
    /** mallRN_delivery_configuration 지역명 추가금 */
    regionExtra: (address1: string, vendor: string) => number;
};

export type HqDeliveryLinePersist = {
    productId: number;
    deliveryType: number;
    deliveryTypeQty: number;
    /** order_goods.delivery_price (본사 저장 규칙) */
    deliveryPrice: number;
    /** order_goods.delivery_add_price (type≠1 도서산간 단가) */
    deliveryAddPrice: number;
};

export type HqDeliveryComputeResult = {
    total: number;
    lines: HqDeliveryLinePersist[];
};

function shopImAreasFee(
    conf: Pick<
        HqShopDeliveryConfig,
        "imAreas1Used" | "imAreas1Price" | "imAreas2Used" | "imAreas2Price"
    >,
    address1: string,
    postcode: string,
    vendor: string,
    resolver: HqImAreasResolver
): number {
    let fee = 0;
    if (conf.imAreas1Used === 1 && /제주특별자치도/i.test(address1)) {
        fee += Math.max(0, toInt(conf.imAreas1Price, 0));
    }
    if (conf.imAreas2Used === 1 && postcode && resolver.isIslandExtra(postcode, vendor)) {
        fee += Math.max(0, toInt(conf.imAreas2Price, 0));
    }
    return fee;
}

function goodsImAreasFee(
    goods: Pick<
        HqDeliveryGoodsInput,
        "imAreas1Used" | "imAreas1Price" | "imAreas2Used" | "imAreas2Price"
    >,
    address1: string,
    postcode: string,
    vendor: string,
    resolver: HqImAreasResolver
): number {
    return shopImAreasFee(goods, address1, postcode, vendor, resolver);
}

/**
 * 본사 주문 생성과 동일한 배송비 합계(+ 품목 저장값).
 * vendor_delivery='' 단일 본사 그룹 기준.
 */
export function computeHqDelivery(
    shop: HqShopDeliveryConfig,
    goodsLines: HqDeliveryGoodsInput[],
    address: HqDeliveryAddress,
    resolver: HqImAreasResolver
): HqDeliveryComputeResult {
    const deliveryType = String(shop.deliveryType ?? "P").trim().toUpperCase();
    const freeThreshold = Math.max(0, toInt(shop.freeThreshold, 0));
    const feeBelow = Math.max(0, toInt(shop.feeBelow, 0));
    const address1 = String(address.address1 ?? "");
    const postcode = String(address.postcode ?? "").trim();
    const vendor = "";

    let vendorDelivery = 0;
    let ckPrice = 0;
    let freeFlag = 0;
    let allCod = true;
    let hasType1 = false;
    const type4Seen = new Set<number>();
    const type5OptionQtyDone = new Set<number>();

    // type5 옵션: 동일 productId 수량 합
    const optionQtyByProduct = new Map<number, number>();
    for (const line of goodsLines) {
        if (toInt(line.deliveryType, 1) !== 5 || !line.hasOption) continue;
        const pid = toInt(line.productId, 0);
        const qty = Math.max(0, toInt(line.qty, 0));
        optionQtyByProduct.set(pid, (optionQtyByProduct.get(pid) ?? 0) + qty);
    }

    const lines: HqDeliveryLinePersist[] = [];

    for (const line of goodsLines) {
        const productId = toInt(line.productId, 0);
        const qty = Math.max(0, toInt(line.qty, 0));
        const goodsType = toInt(line.deliveryType, 1);
        const unitDelivery = Math.max(0, toInt(line.deliveryPrice, 0));
        const typeQty = Math.max(1, toInt(line.deliveryTypeQty, 1));
        const lineSubtotal = Math.max(0, toInt(line.price, 0) * qty);

        let gDelivery = unitDelivery;
        let persistDeliveryPrice = unitDelivery;
        let persistAdd = 0;
        let optionQtyForScale = 0;

        if (goodsType === 1 && deliveryType === "P") {
            ckPrice += lineSubtotal;
            gDelivery = 0;
            persistDeliveryPrice = 0;
        } else if (goodsType === 2) {
            freeFlag = 1;
            gDelivery = 0;
            persistDeliveryPrice = 0;
        } else if (goodsType === 3) {
            gDelivery = 0;
            persistDeliveryPrice = 0;
        } else if (goodsType === 4) {
            if (type4Seen.has(productId)) {
                gDelivery = 0;
                persistDeliveryPrice = 0;
            } else {
                type4Seen.add(productId);
                gDelivery = unitDelivery;
                persistDeliveryPrice = unitDelivery;
            }
        } else if (goodsType === 5) {
            if (line.hasOption) {
                if (type5OptionQtyDone.has(productId)) {
                    gDelivery = 0;
                    optionQtyForScale = 0;
                } else {
                    optionQtyForScale = optionQtyByProduct.get(productId) ?? qty;
                    gDelivery = unitDelivery * Math.ceil(optionQtyForScale / typeQty);
                    type5OptionQtyDone.add(productId);
                }
            } else {
                optionQtyForScale = qty;
                gDelivery = unitDelivery * Math.ceil(qty / typeQty);
            }
            persistDeliveryPrice = unitDelivery;
        } else {
            // 알 수 없는 타입: 선불 0
            gDelivery = 0;
            persistDeliveryPrice = 0;
        }

        if (goodsType !== 3) allCod = false;

        if (goodsType !== 1) {
            let add = goodsImAreasFee(line, address1, postcode, vendor, resolver);
            persistAdd = add;
            if (goodsType === 5) {
                if (line.hasOption) {
                    if (optionQtyForScale === 0) add = 0;
                    else add = add * Math.ceil(optionQtyForScale / typeQty);
                } else {
                    add = add * Math.ceil(qty / typeQty);
                }
            }
            gDelivery += add;
        } else {
            hasType1 = true;
        }

        vendorDelivery += gDelivery;
        lines.push({
            productId,
            deliveryType: goodsType,
            deliveryTypeQty: typeQty,
            deliveryPrice: persistDeliveryPrice,
            deliveryAddPrice: persistAdd,
        });
    }

    // 조건부 본사 배송비 (type1 + P, 무료상품 없으면)
    if (ckPrice > 0 && freeFlag === 0 && deliveryType !== "F") {
        if (ckPrice < freeThreshold) {
            vendorDelivery += feeBelow;
        }
    }

    // type1 있는 주문의 본사 도서산간·지역 추가 (전부 착불이 아닐 때)
    if (!allCod && hasType1) {
        let extra = shopImAreasFee(shop, address1, postcode, vendor, resolver);
        extra += resolver.regionExtra(address1, vendor);
        vendorDelivery += extra;
    }

    return { total: Math.max(0, vendorDelivery), lines };
}

/** 테스트/미리보기용 — 도서산간 DB 없이 0 */
export function emptyImAreasResolver(): HqImAreasResolver {
    return {
        isIslandExtra: () => false,
        regionExtra: () => 0,
    };
}

async function buildImAreasResolver(
    prisma: PrismaClient,
    postcode: string
): Promise<HqImAreasResolver> {
    const normalizedPostcode = String(postcode ?? "").trim();

    // HQ vendor='' : base=0 전역 또는 base=1 && vendor=''
    const areaRows = normalizedPostcode
        ? await prisma.mallRN_im_areas.findMany({
              where: {
                  postcode: normalizedPostcode,
                  OR: [{ base: 0 }, { base: 1, vendor: "" }],
              },
              select: { uid: true },
          })
        : [];

    const excepted = new Set<number>();
    if (areaRows.length) {
        const exceptRows = await prisma.mallRN_im_areas_except.findMany({
            where: {
                vendor: "",
                p_uid: { in: areaRows.map((r) => r.uid) },
            },
            select: { p_uid: true },
        });
        for (const row of exceptRows) excepted.add(toInt(row.p_uid, 0));
    }

    const matchedIsland = areaRows.some((r) => !excepted.has(r.uid));

    const regionRows = await prisma.mallRN_delivery_configuration.findMany({
        where: { vendor: "", used: 1 },
        orderBy: { uid: "asc" },
        select: { title: true, price: true },
    });

    return {
        isIslandExtra: (pc) => Boolean(pc) && pc === normalizedPostcode && matchedIsland,
        regionExtra: (address1) => {
            const addr = String(address1 ?? "");
            for (const row of regionRows) {
                const title = String(row.title ?? "").trim();
                if (!title) continue;
                try {
                    if (new RegExp(title, "i").test(addr)) {
                        return Math.max(0, toInt(row.price, 0));
                    }
                } catch {
                    if (addr.toLowerCase().includes(title.toLowerCase())) {
                        return Math.max(0, toInt(row.price, 0));
                    }
                }
            }
            return 0;
        },
    };
}

export type CalcHqDeliveryOptions = {
    address1?: string;
    postcode?: string;
};

export type OrderDeliveryItem = {
    productId: number;
    qty: number;
    optionId?: number;
};

/**
 * 주문 품목 기준 본사 배송비 합계.
 */
export async function calcHqDeliveryTotal(
    prisma: PrismaClient,
    items: OrderDeliveryItem[],
    options: CalcHqDeliveryOptions = {}
): Promise<number> {
    const result = await calcHqDeliveryBreakdown(prisma, items, options);
    return result.total;
}

/**
 * 합계 + 품목별 저장용 delivery_* (order_goods INSERT).
 */
export async function calcHqDeliveryBreakdown(
    prisma: PrismaClient,
    items: OrderDeliveryItem[],
    options: CalcHqDeliveryOptions = {}
): Promise<HqDeliveryComputeResult> {
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

    const shop: HqShopDeliveryConfig = {
        deliveryType: String(conf?.delivery_type ?? "P"),
        freeThreshold: toInt(conf?.delivery_p_price1, 0),
        feeBelow: toInt(conf?.delivery_p_price2, 0),
        imAreas1Used: toInt(conf?.delivery_im_areas1_used, 0),
        imAreas1Price: toInt(conf?.delivery_im_areas1_price, 0),
        imAreas2Used: toInt(conf?.delivery_im_areas2_used, 0),
        imAreas2Price: toInt(conf?.delivery_im_areas2_price, 0),
    };

    const goodsLines: HqDeliveryGoodsInput[] = [];
    for (const item of items) {
        if (!item?.productId || !item?.qty || item.qty <= 0) continue;
        const product = await prisma.mallRN_goods.findUnique({
            where: { uid: item.productId },
            select: {
                price: true,
                delivery_type: true,
                delivery_price: true,
                delivery_type_qty: true,
                delivery_im_areas1_used: true,
                delivery_im_areas1_price: true,
                delivery_im_areas2_used: true,
                delivery_im_areas2_price: true,
            },
        });
        if (!product) continue;

        goodsLines.push({
            productId: item.productId,
            qty: toInt(item.qty, 0),
            hasOption: item.optionId != null && toInt(item.optionId, 0) > 0,
            price: toInt(product.price, 0),
            deliveryType: toInt(product.delivery_type, 1),
            deliveryPrice: toInt(product.delivery_price, 0),
            deliveryTypeQty: toInt(product.delivery_type_qty, 1),
            imAreas1Used: toInt(product.delivery_im_areas1_used, 0),
            imAreas1Price: toInt(product.delivery_im_areas1_price, 0),
            imAreas2Used: toInt(product.delivery_im_areas2_used, 0),
            imAreas2Price: toInt(product.delivery_im_areas2_price, 0),
        });
    }

    const resolver = await buildImAreasResolver(prisma, options.postcode ?? "");
    return computeHqDelivery(
        shop,
        goodsLines,
        { address1: options.address1, postcode: options.postcode },
        resolver
    );
}

/** @deprecated 테스트 호환 — computeHqDelivery 의 type1만 축약 */
export function computeHqConditionalDelivery(
    conf: { deliveryType: string; freeThreshold: number; feeBelow: number },
    lines: Array<{ goodsDeliveryType: number; lineSubtotal: number }>
): number {
    const goodsLines: HqDeliveryGoodsInput[] = lines.map((line, idx) => ({
        productId: idx + 1,
        qty: 1,
        hasOption: false,
        price: toInt(line.lineSubtotal, 0),
        deliveryType: toInt(line.goodsDeliveryType, 1),
        deliveryPrice: 0,
        deliveryTypeQty: 1,
        imAreas1Used: 0,
        imAreas1Price: 0,
        imAreas2Used: 0,
        imAreas2Price: 0,
    }));
    return computeHqDelivery(
        {
            deliveryType: conf.deliveryType,
            freeThreshold: conf.freeThreshold,
            feeBelow: conf.feeBelow,
            imAreas1Used: 0,
            imAreas1Price: 0,
            imAreas2Used: 0,
            imAreas2Price: 0,
        },
        goodsLines,
        {},
        emptyImAreasResolver()
    ).total;
}
