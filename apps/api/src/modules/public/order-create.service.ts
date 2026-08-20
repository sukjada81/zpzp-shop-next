/**
 * 셀러 스토어프론트 주문 생성 서비스
 *
 * `orders.routes.ts` POST /v1/orders 와 Toss confirm 이 공통으로 사용.
 * Toss 결제 완료 시 payment 옵션을 넘기면 pay_type=C, pay_status=C, reals=1 로 저장.
 *
 * shop-php order_post.php 와 동일한 mallRN_order_info / mallRN_order_goods 스키마 사용.
 */

import type { PrismaClient } from "@prisma/client";
import {
    consumeCoupons,
    pickRepresentativeCoupon,
    resolveCouponSelection,
    resolveMemberLoginId,
} from "./coupon.service.js";

/** shop-next 공개 주문은 DAD 플랫폼 타입 (레거시 mallRN_order_info.platform_type) */
const PLATFORM_TYPE = "DAD";
const STATUS_ORDERED = 0;
/** shop-php order_post.php: 토스 결제 성공 시 goods.status=1 (입금대기 노출 방지) */
const STATUS_PAID = 1;

export type OrderItemInput = {
    productId: number;
    optionId?: number;
    optionName?: string;
    qty: number;
};

type GoodsRow = {
    uid: number;
    name: string;
    cate: bigint | number | null;
    vendor: string | null;
    goods_code: string | null;
    price: number | null;
    orig_price: number | null;
    /** 상품별 배송비(mallRN_goods.delivery_price). 서버 배송비 재계산의 유일한 근거다. */
    delivery_price: number | null;
};

/**
 * 배송비 정책 — 1차 확정본.
 *
 * "주문에 담긴 상품들의 delivery_price 중 최대값을 1회만 부과한다."
 *
 * 근거: 가방쟁이 상품DB(2026-08-07) 4,446건 중 4,083건이 3,500원 단일이고 전 건이 선불이라,
 * 상품별 합산은 실제 배송 실무와 어긋난다(같은 택배로 묶여 나가는데 건당 부과가 됨).
 *
 * ⚠️ 정책 미확정 상태다. 팀장·본사가 확정하면 아래 상수/함수 하나만 바꾸면 된다.
 *   - 상품별 합산으로 갈 경우      → SUM 으로 교체
 *   - 조건부 무료(N원 이상) 도입 시 → FREE_THRESHOLD 를 켜고 계산부에 반영
 * 계산식을 호출부에 흩지 말고 반드시 이 함수 하나만 고칠 것.
 */
export const DELIVERY_FEE_POLICY = {
    /** 'max' = 최대값 1회 부과(1차). 'sum' = 상품별 합산. */
    mode: "max" as "max" | "sum",
    /**
     * 이 금액 이상이면 배송비 0. 기준은 **할인 전 상품합계**다.
     * 쿠폰을 써서 이 밑으로 내려가도 배송비가 되살아나지 않는다(주문 확정 후 할인 변동에
     * 배송비가 흔들리면 승인액 재검증이 무너진다).
     *
     * 30,000 은 본사 정책값이다 — mallRN_configuration.delivery_p_price1 과 같은 값이고
     * PHP 장바구니도 "조건부 무료상품 30,000원 이상 구매시 무료"로 안내하고 있다(php/cart.php).
     *
     * ⚠️ 팀장 확인 항목: 임계값 미만일 때 부과액이 PHP 와 다르다.
     *   PHP  = mallRN_configuration.delivery_p_price2 고정 3,000원
     *   Next = 상품별 delivery_price 중 최대값 1회 (이 파일)
     *   어느 쪽으로 통일할지 확정 전까지 두 계산이 공존한다.
     */
    freeThreshold: 30000,
} as const;

/**
 * 서버측 배송비 산정. 프론트가 보낸 값은 신뢰하지 않고 항상 이 결과와 대조한다.
 * (금액 가드와 동일 원칙 — 아니면 배송비 0원으로 조작해서 결제할 수 있다)
 */
export function computeDeliveryFee(
    products: Array<{ product: GoodsRow }>,
    /** ★할인 전 상품합계★ — 쿠폰 차감 후 금액을 넣으면 안 된다. */
    goodsSubtotal: number
): number {
    if (!products.length) return 0;
    if (DELIVERY_FEE_POLICY.freeThreshold > 0 && goodsSubtotal >= DELIVERY_FEE_POLICY.freeThreshold) {
        return 0;
    }
    const fees = products.map((row) => Math.max(0, toInt(row.product.delivery_price, 0)));
    return DELIVERY_FEE_POLICY.mode === "sum"
        ? fees.reduce((sum, fee) => sum + fee, 0)
        : fees.reduce((max, fee) => Math.max(max, fee), 0);
}

export type CreateStoreOrderInput = {
    tenantId: bigint;
    tenantSlug: string;
    memberUid: bigint;
    /** 결제 시점 링커 스토어 slug (sue.zpzp.kr → sue). 본사몰이면 ''. */
    checkoutShopSlug?: string;
    buyerName: string;
    buyerPhone: string;
    receiverName: string;
    receiverPhone: string;
    /** mallRN_order_info.postcode / address1 / address2 — shop-php order_post.php 와 동일 */
    postcode?: string;
    address1?: string;
    address2?: string;
    pickupAt?: string | null;
    /** 프론트가 청구한 배송비. 서버가 재계산해 대조하며, 없으면 0(배포 순서 하위호환). */
    deliveryFee?: number;
    message?: string;
    memo?: string;
    direct?: number;
    items: OrderItemInput[];
    /** 사용할 쿠폰(mallRN_coupon.uid). 스택 ON이면 일반 1 + 웰컴 1까지. 서버가 최종 검증한다. */
    couponUids?: number[];
    /** Toss confirm 성공 후 전달 — 없으면 무통장 대기(B/A) 주문 */
    payment?: {
        paymentKey: string;
        tossOrderId: string;
        method: string;
        provider: string;
        approvedAtTs: number;
        amount: number;
    };
};

function toInt(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toSafeString(value: unknown, fallback = ""): string {
    const text = String(value ?? "").trim();
    return text || fallback;
}

function toUnixNow(): number {
    return Math.floor(Date.now() / 1000);
}

function buildOrderNum(): string {
    const now = Date.now();
    const rand = Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, "0");
    return `ORD-${now}-${rand}`;
}

/** order_num 유니크 충돌(P2002) 시 재시도 */
function isOrderNumUniqueError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const maybe = error as { code?: string; meta?: { target?: unknown } };
    if (maybe.code !== "P2002") return false;
    const target = maybe.meta?.target;
    if (Array.isArray(target)) {
        return target.some((x) => String(x) === "order_num");
    }
    return String(target ?? "") === "order_num";
}

/** DB에서 상품 조회 + qty>0 필터 — prepare/confirm 양쪽에서 금액 검증에 사용 */
async function loadProducts(
    prisma: PrismaClient,
    items: OrderItemInput[]
): Promise<
    | { ok: true; products: Array<{ item: OrderItemInput; product: GoodsRow }> }
    | { ok: false; message: string }
> {
    const products: Array<{ item: OrderItemInput; product: GoodsRow }> = [];

    for (const item of items) {
        if (!item?.productId || !item?.qty || item.qty <= 0) continue;

        const product = await prisma.mallRN_goods.findUnique({
            where: { uid: item.productId },
            select: {
                uid: true,
                name: true,
                cate: true,
                vendor: true,
                goods_code: true,
                price: true,
                orig_price: true,
                delivery_price: true,
            },
        });

        if (!product) continue;

        products.push({
            item,
            product: {
                uid: product.uid,
                name: product.name,
                cate: product.cate,
                vendor: product.vendor,
                goods_code: product.goods_code,
                price: product.price,
                orig_price: product.orig_price,
                delivery_price: product.delivery_price,
            },
        });
    }

    if (!products.length) {
        return { ok: false, message: "주문 가능한 상품이 없습니다." };
    }

    return { ok: true, products };
}

/**
 * mallRN_order_info + mallRN_order_goods INSERT
 * - payment 있음: pay_type=C, pay_status=C(결제완료), reals=1, pay_info=TOSS|METHOD|PROVIDER
 * - payment 없음: pay_type=B, pay_status=A(입금대기), reals=0 (레거시 오프라인 주문용)
 */
export async function createStoreOrder(
    prisma: PrismaClient,
    input: CreateStoreOrderInput
): Promise<{ ok: true; orderNum: string; payTotal: number } | { ok: false; message: string }> {
    const loaded = await loadProducts(prisma, input.items);
    if (!loaded.ok) return loaded;

    const { products } = loaded;
    const subtotal = products.reduce(
        (sum, row) => sum + toInt(row.product.price, 0) * toInt(row.item.qty, 0),
        0
    );

    // 쿠폰 재검증(결제 승인 후 상태가 바뀌었을 수 있음). 스펙 D2: 할인 전 상품합계 기준.
    const selection = await resolveCouponSelection(
        prisma,
        input.memberUid,
        subtotal,
        input.couponUids
    );
    if (!selection.ok) return { ok: false, message: selection.message };

    const couponRows = selection.rows;
    const couponTotal = selection.discountTotal;

    // 배송비 — 저장된 prepare 값을 그대로 믿지 않고 여기서도 상품 기준으로 재계산한다.
    // 요청에 deliveryFee 가 없으면(구 프론트) 0 → 기존 동작 그대로.
    const expectedDeliveryFee = computeDeliveryFee(products, subtotal);
    const requestedDeliveryFee = input.deliveryFee === undefined ? 0 : toInt(input.deliveryFee, 0);
    if (requestedDeliveryFee !== 0 && requestedDeliveryFee !== expectedDeliveryFee) {
        return { ok: false, message: "배송비가 변경되었습니다. 주문 페이지를 새로고침해 주세요." };
    }
    const deliveryFee = requestedDeliveryFee;

    // 최종 승인액 = 상품합계 − 할인 + 배송비
    const payTotal = subtotal - couponTotal + deliveryFee;

    // 배송비를 실제로 만든 상품 1건에만 delivery_price 를 실어, 품목 합계와 order_info 총액이
    // 어긋나지 않게 한다(정책이 'max 1회 부과'라 전 품목에 실으면 중복 집계가 된다).
    const deliveryBearerUid = deliveryFee > 0
        ? (products.find((row) => toInt(row.product.delivery_price, 0) === deliveryFee)?.product.uid ?? 0)
        : 0;

    // 클라이언트·Toss 승인 금액과 서버 재계산 금액 일치 검증
    if (input.payment && payTotal !== input.payment.amount) {
        return { ok: false, message: "결제금액이 일치하지 않습니다." };
    }

    const couponOwnerId = couponRows.length
        ? await resolveMemberLoginId(prisma, input.memberUid)
        : "";
    if (couponRows.length && !couponOwnerId) {
        return { ok: false, message: "회원 정보를 확인할 수 없습니다." };
    }

    const now = input.payment?.approvedAtTs ?? toUnixNow();
    const isPaid = !!input.payment;
    const paymentMethod = input.payment?.method ?? "";
    const paymentProvider = input.payment?.provider ?? "";
    const paymentKey = input.payment?.paymentKey ?? "";
    const goodsStatus = isPaid ? STATUS_PAID : STATUS_ORDERED;

    let orderNum = "";
    let created = false;
    let couponFailure = "";

    for (let attempt = 0; attempt < 5; attempt += 1) {
        orderNum = buildOrderNum();

        try {
            await prisma.$transaction(async (tx) => {
                await tx.mallRN_order_info.create({
                    data: {
                        id: orderNum,
                        tenant_id: input.tenantId,
                        member_uid: input.memberUid,
                        platform_type: PLATFORM_TYPE,
                        pickup_at: input.pickupAt ? new Date(input.pickupAt) : null,
                        order_num: orderNum,
                        checkout_shop_slug: toSafeString(input.checkoutShopSlug, ""),
                        name: toSafeString(input.buyerName, "주문자"),
                        cell: toSafeString(input.buyerPhone, ""),
                        email: "",
                        name2: toSafeString(input.receiverName, input.buyerName || "수령인"),
                        cell2: toSafeString(input.receiverPhone, input.buyerPhone || ""),
                        postcode: toSafeString(input.postcode, ""),
                        address1: toSafeString(input.address1, ""),
                        address2: toSafeString(input.address2, ""),
                        message: toSafeString(input.message, ""),
                        memo: toSafeString(input.memo, ""),
                        passwd: "",
                        pay_total: payTotal,
                        cancel_total: 0,
                        refund_total: 0,
                        delivery_total: deliveryFee,
                        pay_type: isPaid ? "C" : "B",
                        pay_status: isPaid ? "C" : "A",
                        pay_info: isPaid
                            ? `TOSS|${paymentMethod}|${paymentProvider}`
                            : "",
                        pay_number: isPaid ? paymentKey : "",
                        escrow: 0,
                        bank_info: "",
                        use_mileage: 0,
                        // 장바구니 쿠폰 합계 + 대표 1장. 상세 내역은 zpzp_order_coupon(단일 진실원).
                        use_coupon: couponTotal,
                        coupon_uid: pickRepresentativeCoupon(couponRows),
                        cash_receipts: "",
                        mail_send: 0,
                        cash_issued: 0,
                        tax_issued: 0,
                        direct: input.direct ? 1 : 0,
                        new: 0,
                        sales_issued: 0,
                        mail_ok: 0,
                        reals: isPaid ? 1 : 0,
                        status_date: now,
                        signdate: now,
                        use_td_money: BigInt(0),
                        use_td_point: 0,
                        pay_method: isPaid ? paymentMethod : "",
                    },
                });

                for (const row of products) {
                    await tx.mallRN_order_goods.create({
                        data: {
                            vendor: toSafeString(row.product.vendor, input.tenantSlug || String(input.tenantId)),
                            vendor_delivery: "",
                            tenant_id: input.tenantId,
                            platform_type: PLATFORM_TYPE,
                            commission: 0,
                            order_num: orderNum,
                            g_uid: row.product.uid,
                            g_cate: row.product.cate ?? BigInt(0),
                            g_name: row.product.name,
                            g_code: toSafeString(row.product.goods_code, ""),
                            price: toInt(row.product.price, 0),
                            orig_price: toInt(row.product.orig_price, 0),
                            qty: toInt(row.item.qty, 0),
                            mileage: 0,
                            option: row.item.optionId ?? 0,
                            hotdeal_setting_id: 0,
                            hotdeal_price: 0,
                            option_name: toSafeString(row.item.optionName, ""),
                            // 배송비는 주문당 1회 부과라, 그 금액을 만든 상품 1건만 값을 갖는다.
                            // 나머지는 0 — 품목 합계가 order_info.delivery_total 과 일치한다.
                            delivery_type: 0,
                            delivery_type_qty: 1,
                            delivery_price:
                                deliveryBearerUid && row.product.uid === deliveryBearerUid
                                    ? deliveryFee
                                    : 0,
                            delivery_add_price: 0,
                            delivery_info: "",
                            use_coupon: 0,
                            coupon_uid: 0,
                            discount: 0,
                            discount_info: "",
                            status: goodsStatus,
                            status2: 0,
                            status_date: now,
                            reals: isPaid ? 1 : 0,
                            signdate: now,
                        },
                    });
                }

                // 쿠폰 소비는 반드시 같은 트랜잭션 안에서. 동시 사용이면 throw → 주문까지 롤백.
                await consumeCoupons(tx, couponOwnerId, couponRows, orderNum, now);
            });

            created = true;
            break;
        } catch (error: unknown) {
            if (isOrderNumUniqueError(error)) continue;
            if (error instanceof Error && error.message.startsWith("COUPON_ALREADY_USED")) {
                couponFailure = "이미 사용된 쿠폰입니다. 쿠폰을 다시 선택해 주세요.";
                break;
            }
            throw error;
        }
    }

    if (couponFailure) {
        return { ok: false, message: couponFailure };
    }

    if (!created || !orderNum) {
        return {
            ok: false,
            message: "주문번호 생성 중 충돌이 발생했습니다. 다시 시도해 주세요.",
        };
    }

    return { ok: true, orderNum, payTotal };
}

export function computeOrderAmount(
    products: Array<{ item: OrderItemInput; product: GoodsRow }>
): number {
    return products.reduce(
        (sum, row) => sum + toInt(row.product.price, 0) * toInt(row.item.qty, 0),
        0
    );
}

/** prepare 단계: 서버-side 금액 재계산 (클라이언트 amount 신뢰하지 않음) */
export async function validateOrderItems(
    prisma: PrismaClient,
    items: OrderItemInput[]
): Promise<
    | {
        ok: true;
        products: Array<{ item: OrderItemInput; product: GoodsRow }>;
        /** ★계약: 할인 전 '상품합계'. 배송비는 여기 포함하지 않는다. */
        amount: number;
        /** 서버가 상품별 delivery_price 로 재계산한 배송비. 프론트 값 대조용. */
        deliveryFee: number;
    }
    | { ok: false; message: string }
> {
    const loaded = await loadProducts(prisma, items);
    if (!loaded.ok) return loaded;

    const amount = computeOrderAmount(loaded.products);

    return {
        ok: true,
        products: loaded.products,
        amount,
        deliveryFee: computeDeliveryFee(loaded.products, amount),
    };
}
