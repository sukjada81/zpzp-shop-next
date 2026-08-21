/**
 * 고객 결제완료 상품 부분취소 (Next 전용, shop-php 미호출).
 * 무료배송 → 잔여 미만으로 배송비 발생 시 환불액에서 차감 (본사 delivery2 개념).
 */
import type { PrismaClient } from "@prisma/client";
import { calcHqDeliveryTotal } from "../delivery/hq-delivery.js";
import {
    emergingDeliveryOnCancel,
    refundAmountAfterDeliveryAdjust,
} from "../delivery/cancel-refund-adjust.js";
import { cancelTossPaymentPartialAmount } from "../toss-order-cancel.js";

const STATUS_CANCELED = 9;
const STATUS2_DONE = 5;
const PLATFORM_TYPE = "DAD";

function toInt(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toSafeString(value: unknown, fallback = ""): string {
    const text = String(value ?? "").trim();
    return text || fallback;
}

async function restoreGoodsQty(
    prisma: PrismaClient,
    row: { g_uid: number; qty: number; option: number }
) {
    const qty = Math.max(0, toInt(row.qty, 0));
    if (qty <= 0) return;

    if (row.option > 0) {
        const opt = await prisma.mallRN_goods_option.findUnique({
            where: { uid: row.option },
            select: { qty_type: true },
        });
        if (opt && toInt(opt.qty_type, 1) === 0) {
            await prisma.mallRN_goods_option.update({
                where: { uid: row.option },
                data: { qty: { increment: qty } },
            });
        }
    } else {
        const goods = await prisma.mallRN_goods.findUnique({
            where: { uid: row.g_uid },
            select: { qty_type: true },
        });
        if (goods && toInt(goods.qty_type, 1) === 0) {
            await prisma.mallRN_goods.update({
                where: { uid: row.g_uid },
                data: { qty: { increment: qty } },
            });
        }
    }

    const goodsCnt = await prisma.mallRN_goods.findUnique({
        where: { uid: row.g_uid },
        select: { order_cnt: true },
    });
    const orderCnt = toInt(goodsCnt?.order_cnt, 0);
    if (orderCnt > 0) {
        const dec = Math.min(orderCnt, qty);
        await prisma.mallRN_goods.update({
            where: { uid: row.g_uid },
            data: { order_cnt: { decrement: dec } },
        });
    }
}

export type CustomerPaidItemCancelResult =
    | {
          ok: true;
          cancelAmount: number;
          emergingDelivery: number;
          lineAmount: number;
          deliveryTotal: number;
          paymentStatus?: string;
      }
    | { ok: false; code: string; message: string };

/**
 * 결제완료(status=1) 상품 1건 부분취소.
 * 마지막 남은 상품이면 호출하지 말 것(전액 잔액 취소는 기존 브리지/전체취소 경로).
 */
export async function cancelCustomerPaidOrderItem(input: {
    prisma: PrismaClient;
    tenantId: bigint;
    orderNum: string;
    orderGoodsUid: number;
    memberUid: bigint;
    memberLoginId: string;
    memberName: string;
    now: number;
}): Promise<CustomerPaidItemCancelResult> {
    const { prisma, tenantId, orderNum, orderGoodsUid, now } = input;

    const info = await prisma.mallRN_order_info.findFirst({
        where: {
            tenant_id: tenantId,
            platform_type: PLATFORM_TYPE,
            order_num: orderNum,
            reals: 1,
        },
        select: {
            pay_total: true,
            delivery_total: true,
            cancel_total: true,
            postcode: true,
            address1: true,
            name: true,
            id: true,
        },
    });
    if (!info) {
        return { ok: false, code: "ORDER_NOT_FOUND", message: "주문을 찾을 수 없습니다." };
    }

    const allGoods = await prisma.mallRN_order_goods.findMany({
        where: {
            tenant_id: tenantId,
            platform_type: PLATFORM_TYPE,
            order_num: orderNum,
            reals: 1,
        },
        select: {
            uid: true,
            g_uid: true,
            price: true,
            qty: true,
            option: true,
            status: true,
            status2: true,
            vendor: true,
            use_coupon: true,
            coupon_uid: true,
            delivery_type: true,
            delivery_price: true,
        },
        orderBy: { uid: "asc" },
    });

    const target = allGoods.find((g) => g.uid === orderGoodsUid);
    if (!target) {
        return { ok: false, code: "GOODS_NOT_FOUND", message: "주문상품을 찾을 수 없습니다." };
    }
    if (toInt(target.status, 0) !== 1 || toInt(target.status2, 0) !== 0) {
        return {
            ok: false,
            code: "INVALID_STATUS",
            message: "결제완료 상품만 즉시 취소할 수 있습니다.",
        };
    }

    const active = allGoods.filter((g) => toInt(g.status, 0) !== STATUS_CANCELED);
    if (active.length <= 1) {
        return {
            ok: false,
            code: "USE_FULL_CANCEL_PATH",
            message: "마지막 상품은 전체 잔액 취소 경로를 사용해야 합니다.",
        };
    }

    const lineAmount = Math.max(0, toInt(target.price, 0) * toInt(target.qty, 0));
    const address = {
        address1: toSafeString(info.address1, ""),
        postcode: toSafeString(info.postcode, ""),
    };

    const activeItems = active.map((g) => ({
        productId: toInt(g.g_uid, 0),
        qty: toInt(g.qty, 0),
        optionId: toInt(g.option, 0) > 0 ? toInt(g.option, 0) : undefined,
    }));
    const remainingItems = active
        .filter((g) => g.uid !== orderGoodsUid)
        .map((g) => ({
            productId: toInt(g.g_uid, 0),
            qty: toInt(g.qty, 0),
            optionId: toInt(g.option, 0) > 0 ? toInt(g.option, 0) : undefined,
        }));

    const deliveryBefore = await calcHqDeliveryTotal(prisma, activeItems, address);
    const deliveryAfter = await calcHqDeliveryTotal(prisma, remainingItems, address);
    const emergingDelivery = emergingDeliveryOnCancel({
        deliveryBefore,
        deliveryAfter,
    });
    const refundAmount = refundAmountAfterDeliveryAdjust({
        lineAmount,
        emergingDelivery,
    });

    const pg = await cancelTossPaymentPartialAmount(prisma, {
        orderNum,
        cancelAmount: refundAmount,
        cancelReason: "고객 상품 취소",
        requestKey: `customer-item-${orderGoodsUid}-adj`,
        requestSource: "customer",
        requestedBy: toSafeString(input.memberLoginId, "회원"),
    });

    if (!pg.ok) {
        return { ok: false, code: pg.code, message: pg.message };
    }

    let remainingSum = 0;
    for (const g of active) {
        if (g.uid === orderGoodsUid) continue;
        remainingSum += toInt(g.price, 0) * toInt(g.qty, 0);
    }

    const prevCancel = toInt(info.cancel_total, 0);
    // 화면 취소금액 = 실환불 누적 (배송비 발생분 차감 반영)
    const nextCancel = prevCancel + refundAmount;
    // 장부 pay_total = 잔여상품 + 잔여배송 + 실환불누적 (최초 승인액과 맞추기 쉬움)
    const nextPayTotal = remainingSum + deliveryAfter + nextCancel;

    await prisma.$transaction(async (tx) => {
        await tx.mallRN_order_goods.update({
            where: { uid: orderGoodsUid },
            data: {
                status: STATUS_CANCELED,
                status2: STATUS2_DONE,
                status_date: now,
            },
        });

        await tx.mallRN_order_log.create({
            data: {
                order_num: orderNum,
                og_uid: orderGoodsUid,
                id: toSafeString(input.memberLoginId, "회원").slice(0, 50),
                prev_status: 1,
                prev_status2: 0,
                status: STATUS_CANCELED,
                status2: STATUS2_DONE,
                signdate: now,
            },
        });

        const existingSc = await tx.mallRN_order_status_change.findFirst({
            where: {
                order_num: orderNum,
                og_uid: orderGoodsUid,
                status: STATUS_CANCELED,
                status2: STATUS2_DONE,
            },
            select: { uid: true },
        });
        if (!existingSc) {
            await tx.mallRN_order_status_change.create({
                data: {
                    id: toSafeString(input.memberLoginId, "회원").slice(0, 50),
                    name: toSafeString(input.memberName || info.name, "회원").slice(0, 50),
                    manager: "즉시취소",
                    vendor: toSafeString(target.vendor, "").slice(0, 50),
                    order_num: orderNum,
                    og_uid: orderGoodsUid,
                    reason: "고객 상품 취소",
                    bank_info: "",
                    refund: lineAmount,
                    delivery: 0,
                    delivery2: emergingDelivery,
                    mileage: 0,
                    coupon: 0,
                    refund_fee: 0,
                    status: STATUS_CANCELED,
                    status2: STATUS2_DONE,
                    status_date: now,
                    signdate: now,
                },
            });
        }

        await tx.mallRN_order_info.updateMany({
            where: {
                tenant_id: tenantId,
                platform_type: PLATFORM_TYPE,
                order_num: orderNum,
            },
            data: {
                pay_total: nextPayTotal,
                delivery_total: deliveryAfter,
                cancel_total: nextCancel,
                status_date: now,
            },
        });

        await tx.mallRN_order_delivery.deleteMany({ where: { order_num: orderNum } });
        if (deliveryAfter > 0) {
            await tx.mallRN_order_delivery.create({
                data: {
                    order_num: orderNum,
                    vendor: "",
                    price: deliveryAfter,
                    adds: 0,
                    info: "P|next-adj",
                    signdate: now,
                },
            });
        }
    });

    await restoreGoodsQty(prisma, {
        g_uid: toInt(target.g_uid, 0),
        qty: toInt(target.qty, 0),
        option: toInt(target.option, 0),
    });

    if (toInt(target.use_coupon, 0) > 0 && toInt(target.coupon_uid, 0) > 0) {
        try {
            await prisma.mallRN_coupon.updateMany({
                where: {
                    uid: toInt(target.coupon_uid, 0),
                    id: toSafeString(input.memberLoginId, ""),
                },
                data: { status: 0, usedate: 0 },
            });
        } catch {
            // 쿠폰 복원 실패해도 취소 자체는 유지
        }
    }

    return {
        ok: true,
        cancelAmount: refundAmount,
        emergingDelivery,
        lineAmount,
        deliveryTotal: deliveryAfter,
        paymentStatus: pg.ok && "paymentStatus" in pg ? pg.paymentStatus : undefined,
    };
}
