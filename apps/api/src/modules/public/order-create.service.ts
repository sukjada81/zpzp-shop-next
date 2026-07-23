// apps/api/src/modules/public/order-create.service.ts
// public orders.routes.ts 주문 생성 로직 — Toss confirm에서도 재사용

import type { PrismaClient } from "@prisma/client";

const PLATFORM_TYPE = "DAD";
const STATUS_ORDERED = 0;

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
};

export type CreateStoreOrderInput = {
    tenantId: bigint;
    tenantSlug: string;
    memberUid: bigint;
    buyerName: string;
    buyerPhone: string;
    receiverName: string;
    receiverPhone: string;
    pickupAt?: string | null;
    message?: string;
    memo?: string;
    direct?: number;
    items: OrderItemInput[];
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
            },
        });
    }

    if (!products.length) {
        return { ok: false, message: "주문 가능한 상품이 없습니다." };
    }

    return { ok: true, products };
}

export async function createStoreOrder(
    prisma: PrismaClient,
    input: CreateStoreOrderInput
): Promise<{ ok: true; orderNum: string; payTotal: number } | { ok: false; message: string }> {
    const loaded = await loadProducts(prisma, input.items);
    if (!loaded.ok) return loaded;

    const { products } = loaded;
    const payTotal = products.reduce(
        (sum, row) => sum + toInt(row.product.price, 0) * toInt(row.item.qty, 0),
        0
    );

    if (input.payment && payTotal !== input.payment.amount) {
        return { ok: false, message: "결제금액이 일치하지 않습니다." };
    }

    const now = input.payment?.approvedAtTs ?? toUnixNow();
    const isPaid = !!input.payment;
    const paymentMethod = input.payment?.method ?? "";
    const paymentProvider = input.payment?.provider ?? "";
    const paymentKey = input.payment?.paymentKey ?? "";

    let orderNum = "";
    let created = false;

    for (let attempt = 0; attempt < 5; attempt += 1) {
        orderNum = buildOrderNum();

        try {
            const txOps = [
                prisma.mallRN_order_info.create({
                    data: {
                        id: orderNum,
                        tenant_id: input.tenantId,
                        member_uid: input.memberUid,
                        platform_type: PLATFORM_TYPE,
                        pickup_at: input.pickupAt ? new Date(input.pickupAt) : null,
                        order_num: orderNum,
                        name: toSafeString(input.buyerName, "주문자"),
                        cell: toSafeString(input.buyerPhone, ""),
                        email: "",
                        name2: toSafeString(input.receiverName, input.buyerName || "수령인"),
                        cell2: toSafeString(input.receiverPhone, input.buyerPhone || ""),
                        postcode: "",
                        address1: "",
                        address2: "",
                        message: toSafeString(input.message, ""),
                        memo: toSafeString(input.memo, ""),
                        passwd: "",
                        pay_total: payTotal,
                        cancel_total: 0,
                        refund_total: 0,
                        delivery_total: 0,
                        pay_type: isPaid ? "C" : "B",
                        pay_status: isPaid ? "C" : "A",
                        pay_info: isPaid
                            ? `TOSS|${paymentMethod}|${paymentProvider}`
                            : "",
                        pay_number: isPaid ? paymentKey : "",
                        escrow: 0,
                        bank_info: "",
                        use_mileage: 0,
                        use_coupon: 0,
                        coupon_uid: 0,
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
                }),
                ...products.map((row) =>
                    prisma.mallRN_order_goods.create({
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
                            delivery_type: 0,
                            delivery_type_qty: 1,
                            delivery_price: 0,
                            delivery_add_price: 0,
                            delivery_info: "",
                            use_coupon: 0,
                            coupon_uid: 0,
                            discount: 0,
                            discount_info: "",
                            status: STATUS_ORDERED,
                            status2: STATUS_ORDERED,
                            status_date: now,
                            reals: isPaid ? 1 : 0,
                            signdate: now,
                        },
                    })
                ),
            ];

            await prisma.$transaction(txOps);
            created = true;
            break;
        } catch (error: unknown) {
            if (isOrderNumUniqueError(error)) continue;
            throw error;
        }
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

export async function validateOrderItems(
    prisma: PrismaClient,
    items: OrderItemInput[]
): Promise<
    | { ok: true; products: Array<{ item: OrderItemInput; product: GoodsRow }>; amount: number }
    | { ok: false; message: string }
> {
    const loaded = await loadProducts(prisma, items);
    if (!loaded.ok) return loaded;

    return {
        ok: true,
        products: loaded.products,
        amount: computeOrderAmount(loaded.products),
    };
}
