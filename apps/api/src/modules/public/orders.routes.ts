// apps/api/src/modules/public/orders.routes.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { captureRefFromRequest } from "../attribution/capture.js";
import { requireAdmin } from "../../common/guard.js";
import {
    consumeCoupons,
    pickRepresentativeCoupon,
    resolveCouponSelection,
    resolveMemberLoginId,
} from "./coupon.service.js";
import {
    buildGoodsStatusLabel,
    isOnlinePrepaidOrder,
    resolveCustomerOrderDisplay,
} from "../../lib/order/customer-order-display.js";
import { cancelTossPaymentForOrder } from "../../lib/toss-order-cancel.js";
import { callPhpBridge } from "../../lib/php-bridge.js";

const PLATFORM_TYPE = "DAD";
const STATUS_ORDERED = 0;
const STATUS_CANCELED = 9;
const STATUS_EXCHANGE = 7;
const STATUS_RETURN = 8;
const STATUS2_REQUEST = 1;

const ORDER_INFO_PUBLIC_SELECT = {
    uid: true,
    id: true,
    order_num: true,
    name: true,
    cell: true,
    name2: true,
    cell2: true,
    postcode: true,
    address1: true,
    address2: true,
    message: true,
    memo: true,
    pay_total: true,
    cancel_total: true,
    refund_total: true,
    delivery_total: true,
    pay_type: true,
    pay_status: true,
    pay_info: true,
    pay_method: true,
    pickup_at: true,
    status_date: true,
    signdate: true,
    member_uid: true,
} as const;

type PublicCreateOrderBody = {
    buyerName?: string;
    buyerPhone?: string;
    receiverName?: string;
    receiverPhone?: string;
    postcode?: string;
    address1?: string;
    address2?: string;
    pickupAt?: string | null;
    message?: string;
    memo?: string;
    direct?: number;
    items: {
        productId: number;
        optionId?: number;
        optionName?: string;
        qty: number;
    }[];
    /** 사용할 쿠폰(mallRN_coupon.uid). 스택 ON이면 일반 1 + 웰컴 1까지. 서버가 최종 검증한다. */
    couponUids?: number[];
};

type GuestOrderListBody = {
    phone?: string;
    orderNums?: string[];
};

type GuestOrderCancelBody = {
    phone?: string;
};

type PublicOrderRoute = {
    Body: PublicCreateOrderBody;
    Params: { tenant?: string };
};

type TenantContext = {
    tenantId?: bigint | string | number | null;
    tenantSlug?: string;
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

type OrderInfoRow = {
    uid: number;
    id: string;
    order_num: string;
    name: string;
    cell: string;
    name2: string;
    cell2: string;
    message: string | null;
    memo: string | null;
    pay_total: number;
    cancel_total: number;
    refund_total: number;
    delivery_total: number;
    pay_type: string;
    pay_status: string;
    pay_info: string;
    pay_method: string;
    postcode: string;
    address1: string;
    address2: string;
    pickup_at: Date | null;
    status_date: number;
    signdate: number;
    member_uid?: bigint | number | null;
};

type OrderGoodsRow = {
    uid: number;
    g_uid: number;
    g_name: string;
    g_code: string;
    price: number;
    orig_price: number;
    qty: number;
    option: number;
    option_name: string;
    status: number;
    status2: number;
    signdate: number;
};

function toBigIntId(value: unknown): bigint | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "bigint") return value;

    if (typeof value === "number") {
        if (!Number.isFinite(value)) return null;
        return BigInt(Math.trunc(value));
    }

    const text = String(value).trim();
    if (!text) return null;

    try {
        return BigInt(text);
    } catch {
        return null;
    }
}

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

function normalizePhone(value: unknown): string {
    return String(value ?? "").replace(/[^\d]/g, "");
}

function getTenantContext(
    request: FastifyRequest<PublicOrderRoute>
): { tenantId: bigint | null; tenantSlug: string } {
    const ctx = request as FastifyRequest<PublicOrderRoute> & TenantContext;

    return {
        tenantId: toBigIntId(ctx.tenantId),
        tenantSlug: toSafeString(ctx.tenantSlug || request.params?.tenant || ""),
    };
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
        return error.message || fallback;
    }
    return fallback;
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

function buildOrderNum(): string {
    const now = Date.now();
    const rand = Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, "0");
    return `ORD-${now}-${rand}`;
}

function toIsoDate(value: unknown): string {
    if (!value) return new Date().toISOString();

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
    }

    if (typeof value === "number") {
        const ms = value < 1_000_000_000_000 ? value * 1000 : value;
        const d = new Date(ms);
        return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    }

    if (typeof value === "bigint") {
        const n = Number(value);
        if (!Number.isFinite(n)) return new Date().toISOString();
        return toIsoDate(n);
    }

    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function maskBuyerName(value: unknown): string {
    const text = toSafeString(value, "");
    if (!text) return "고객";

    if (text.length <= 1) return `${text}*`;
    if (text.length === 2) return `${text[0]}*`;

    return `${text[0]}${"*".repeat(Math.max(1, text.length - 2))}${text[text.length - 1]}`;
}

function minutesAgoFromUnix(signdate: unknown): number {
    const ts = toInt(signdate, 0);
    if (!ts) return 0;

    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff <= 0) return 0;

    return Math.floor(diff / 60);
}

function resolveOrderGoodsStatus(items: Array<{ status: number; status2: number }>) {
    const first = items[0];
    return {
        goodsStatus: toInt(first?.status, STATUS_ORDERED),
        goodsStatus2: toInt(first?.status2, 0),
    };
}

async function readOrderGoodsStatus(
    prisma: FastifyInstance["prisma"],
    tenantId: bigint,
    orderNum: string
) {
    const goodsRows = await prisma.mallRN_order_goods.findMany({
        where: {
            tenant_id: tenantId,
            platform_type: PLATFORM_TYPE,
            order_num: orderNum,
        },
        select: { status: true, status2: true },
        take: 1,
    });

    return resolveOrderGoodsStatus(goodsRows);
}

// 셀러 취소 가능 조건: 이미 취소된 게 아니면 항상 허용
function canSellerCancel(status: number): boolean {
    return status !== STATUS_CANCELED;
}

async function getStrictestSaleEndAt(
    prisma: FastifyInstance["prisma"],
    tenantId: bigint,
    orderNum: string
): Promise<Date | null> {
    const goodsLinks = await prisma.mallRN_order_goods.findMany({
        where: {
            tenant_id: tenantId,
            platform_type: PLATFORM_TYPE,
            order_num: orderNum,
        },
        select: { g_uid: true },
    });

    const uids = Array.from(
        new Set(goodsLinks.map((r) => Number(r.g_uid)).filter((n) => n > 0))
    );
    if (!uids.length) return null;

    const products = await prisma.mallRN_goods.findMany({
        where: { uid: { in: uids } },
        select: { sale_end_at: true },
    });

    let earliest: Date | null = null;
    for (const p of products) {
        const end = p.sale_end_at ? new Date(p.sale_end_at) : null;
        if (!end) continue;
        if (!earliest || end.getTime() < earliest.getTime()) earliest = end;
    }
    return earliest;
}

function pad2Pickup(n: number): string {
    return String(n).padStart(2, "0");
}

// 상품 등록 정보(mallRN_goods)의 픽업일을 사람이 읽기 쉬운 텍스트로 변환.
// 날짜는 .000Z(한국시간 리터럴)로 저장되므로 getUTC* 로 그대로 읽는다.
function formatPickupDateText(value: Date | null): string {
    if (!value) return "";
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const mm = pad2Pickup(d.getUTCMonth() + 1);
    const dd = pad2Pickup(d.getUTCDate());
    const dayKor = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()] ?? "";
    return `${mm}.${dd}(${dayKor})`;
}

// 주문에 포함된 상품들의 "상품 등록 시 입력한 픽업일"을 노출용 텍스트로 반환.
// pickup_note(픽업 안내문)가 있으면 우선 사용하고, 없으면 가장 이른
// pickup_start_at 을 "MM.DD(요일)~" 로 표기한다.
async function getOrderPickupText(
    prisma: FastifyInstance["prisma"],
    tenantId: bigint,
    orderNum: string
): Promise<string> {
    const goodsLinks = await prisma.mallRN_order_goods.findMany({
        where: {
            tenant_id: tenantId,
            platform_type: PLATFORM_TYPE,
            order_num: orderNum,
        },
        select: { g_uid: true },
    });

    const uids = Array.from(
        new Set(goodsLinks.map((r) => Number(r.g_uid)).filter((n) => n > 0))
    );
    if (!uids.length) return "";

    const products = await prisma.mallRN_goods.findMany({
        where: { uid: { in: uids } },
        select: { pickup_start_at: true, pickup_note: true },
    });

    let earliest: Date | null = null;
    let noteForEarliest = "";
    let anyNote = "";
    for (const p of products) {
        const note = toSafeString(p.pickup_note, "").trim();
        if (note && !anyNote) anyNote = note;
        const start = p.pickup_start_at ? new Date(p.pickup_start_at) : null;
        if (!start || Number.isNaN(start.getTime())) continue;
        if (!earliest || start.getTime() < earliest.getTime()) {
            earliest = start;
            noteForEarliest = note;
        }
    }

    if (noteForEarliest) return noteForEarliest;
    const dateText = formatPickupDateText(earliest);
    if (dateText) return `${dateText}~`;
    return anyNote;
}

type OrderActionLogInput = {
    tenantId: bigint;
    eventType: "cancel" | "pickup_confirm";
    orderNum: string;
    orderGoodsUid?: number | null;
    actorRole: "member" | "guest" | "seller" | "admin" | "hq";
    actorMemberUid?: bigint | number | null;
    actorNickname: string;
    beforeStatus?: number | null;
    afterStatus?: number | null;
    reason?: string | null;
    metaJson?: string | null;
};

async function writeOrderActionLog(
    client: { dad_order_action_log: FastifyInstance["prisma"]["dad_order_action_log"] },
    input: OrderActionLogInput
) {
    await client.dad_order_action_log.create({
        data: {
            tenant_id: input.tenantId,
            event_type: input.eventType,
            order_num: input.orderNum,
            order_goods_uid: input.orderGoodsUid ?? null,
            actor_role: input.actorRole,
            actor_member_uid:
                input.actorMemberUid != null
                    ? BigInt(String(input.actorMemberUid))
                    : null,
            actor_nickname: input.actorNickname.slice(0, 100),
            before_status: input.beforeStatus ?? null,
            after_status: input.afterStatus ?? null,
            reason: input.reason ?? null,
            meta_json: input.metaJson ?? null,
        },
    });
}

type CustomerCancelOrderRow = {
    pay_type?: string | null;
    pay_status?: string | null;
    pay_info?: string | null;
    name?: string | null;
};

/** 배송준비 전 고객 즉시 취소 — 온라인 선결제는 Toss PG 취소 성공 후 DB 반영 */
async function executeCustomerImmediateCancel(input: {
    prisma: FastifyInstance["prisma"];
    tenantId: bigint;
    orderNum: string;
    orderRow: CustomerCancelOrderRow;
    cancelDisplay: ReturnType<typeof resolveCustomerOrderDisplay>;
    actorRole: "member" | "guest";
    actorMemberUid?: bigint | number | null;
    actorNickname: string;
    now: number;
}): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
    const payType = toSafeString(input.orderRow.pay_type, "B");
    const payStatus = toSafeString(input.orderRow.pay_status, "A");
    const payInfo = toSafeString(input.orderRow.pay_info, "");
    const isOnlinePrepaid = isOnlinePrepaidOrder(payType, payStatus, payInfo);

    if (isOnlinePrepaid) {
        const pgResult = await cancelTossPaymentForOrder(input.prisma, {
            orderNum: input.orderNum,
            cancelReason: "고객 주문 취소",
            requestKey: `customer-cancel-${input.orderNum}`,
            requestSource: input.actorRole === "guest" ? "guest" : "member",
            requestedBy: input.actorNickname,
        });

        if (!pgResult.ok) {
            return {
                ok: false,
                code: pgResult.code,
                message: pgResult.message,
            };
        }
    }

    await input.prisma.$transaction(async (tx: any) => {
        await tx.mallRN_order_info.updateMany({
            where: {
                tenant_id: input.tenantId,
                platform_type: PLATFORM_TYPE,
                order_num: input.orderNum,
            },
            data: {
                status_date: input.now,
            },
        });

        await tx.mallRN_order_goods.updateMany({
            where: {
                tenant_id: input.tenantId,
                platform_type: PLATFORM_TYPE,
                order_num: input.orderNum,
            },
            data: {
                status: STATUS_CANCELED,
                status2: STATUS_CANCELED,
                status_date: input.now,
            },
        });

        await writeOrderActionLog(tx, {
            tenantId: input.tenantId,
            eventType: "cancel",
            orderNum: input.orderNum,
            actorRole: input.actorRole,
            actorMemberUid: input.actorMemberUid ?? null,
            actorNickname: input.actorNickname,
            beforeStatus: input.cancelDisplay.effectiveGoodsStatus,
            afterStatus: STATUS_CANCELED,
        });
    });

    return { ok: true };
}

type ClaimGoodsRow = {
    uid: number;
    vendor: string;
    status: number;
    status2: number;
};

/**
 * 반품·교환 접수 시 구매확정 D+7 타이머를 정지시킨다.
 *
 * shop-next 는 mallRN_order_goods 를 Prisma 로 직접 갱신해 PHP 훅을 우회하므로,
 * PHP 경로(php/order_status_post.php)가 하던 zpzpTimerReconcile('pause') 이 빠진다.
 * 빠지면 반품 심사 중에도 D+7 시계가 계속 흘러, 반려·철회로 배송완료 상태가 돌아온
 * 직후 confirm_sweep 이 즉시 자동확정해 버린다. 그래서 내부 브리지로 같은 일을 시킨다.
 *
 * 재개(resume)는 철회·반려 경로가 PHP 에만 있어 그쪽에서 이미 처리한다
 * (order_status_post.php withdraw / managers/order/order_post.php reject).
 * shop-next 에 복귀 경로가 생기면 여기 대칭으로 resume 호출을 추가해야 한다.
 *
 * 실패는 비치명 — 브리지가 죽어도 클레임 접수 자체는 성립해야 하므로 로그만 남긴다.
 */
async function pauseConfirmTimersForClaim(
    fastify: FastifyInstance,
    input: { orderNum: string; goodsUids: number[]; reason: "return" | "exchange" }
) {
    for (const orderGoodsUid of input.goodsUids) {
        try {
            const result = await callPhpBridge("/php/settlement_api.php", {
                action: "timer_reconcile",
                timer_action: "pause",
                order_goods_uid: orderGoodsUid,
                order_num: input.orderNum,
                reason: input.reason,
            });
            if (!result.ok) {
                fastify.log.warn(
                    { orderNum: input.orderNum, orderGoodsUid, status: result.status },
                    "CLAIM_TIMER_PAUSE_FAILED"
                );
            }
        } catch (error) {
            fastify.log.warn({ error, orderNum: input.orderNum, orderGoodsUid }, "CLAIM_TIMER_PAUSE_ERROR");
        }
    }
}

/** shop-php statusX1 — 본사 교환/반품/취소접수(order_change_list) 연동 */
async function writeClaimStatusChangeRecords(
    tx: {
        mallRN_order_status_change: {
            findFirst: (args: unknown) => Promise<{ uid: number } | null>;
            create: (args: unknown) => Promise<unknown>;
        };
        mallRN_order_log: { create: (args: unknown) => Promise<unknown> };
    },
    goodsRows: ClaimGoodsRow[],
    input: {
        orderNum: string;
        memberId: string;
        memberName: string;
        claimStatus: number;
        reason: string;
        now: number;
    }
) {
    const reason = toSafeString(input.reason, "고객 요청").slice(0, 100);
    const memberId = toSafeString(input.memberId, "").slice(0, 50) || "회원";
    const memberName = toSafeString(input.memberName, "회원").slice(0, 50);

    for (const row of goodsRows) {
        const existing = await tx.mallRN_order_status_change.findFirst({
            where: {
                order_num: input.orderNum,
                og_uid: row.uid,
                status: input.claimStatus,
                status2: STATUS2_REQUEST,
            },
            select: { uid: true },
        });
        if (existing) continue;

        await tx.mallRN_order_status_change.create({
            data: {
                id: memberId,
                name: memberName,
                vendor: toSafeString(row.vendor, "").slice(0, 50),
                order_num: input.orderNum,
                og_uid: row.uid,
                reason,
                bank_info: "",
                status: input.claimStatus,
                status2: STATUS2_REQUEST,
                status_date: 0,
                signdate: input.now,
            },
        });

        await tx.mallRN_order_log.create({
            data: {
                order_num: input.orderNum,
                og_uid: row.uid,
                id: memberId,
                prev_status: row.status,
                prev_status2: row.status2,
                status: input.claimStatus,
                status2: STATUS2_REQUEST,
                signdate: input.now,
            },
        });
    }
}

function getObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object") return null;
    return value as Record<string, unknown>;
}

function readNestedValue(
    source: Record<string, unknown> | null,
    path: string[]
): unknown {
    let current: unknown = source;
    for (const key of path) {
        const obj = getObject(current);
        if (!obj || !(key in obj)) return undefined;
        current = obj[key];
    }
    return current;
}

function extractAuthenticatedMemberUid(request: FastifyRequest): bigint | null {
    const root = getObject(request);
    if (!root) return null;

    const candidates: unknown[] = [
        readNestedValue(root, ["member_uid"]),
        readNestedValue(root, ["memberUid"]),
        readNestedValue(root, ["user", "uid"]),
        readNestedValue(root, ["user", "member_uid"]),
        readNestedValue(root, ["user", "memberUid"]),
        readNestedValue(root, ["member", "uid"]),
        readNestedValue(root, ["member", "member_uid"]),
        readNestedValue(root, ["member", "memberUid"]),
        readNestedValue(root, ["session", "uid"]),
        readNestedValue(root, ["session", "member_uid"]),
        readNestedValue(root, ["session", "memberUid"]),
        readNestedValue(root, ["session", "member", "uid"]),
        readNestedValue(root, ["session", "member", "member_uid"]),
        readNestedValue(root, ["session", "member", "memberUid"]),
        readNestedValue(root, ["session", "user", "uid"]),
        readNestedValue(root, ["session", "user", "member_uid"]),
        readNestedValue(root, ["session", "user", "memberUid"]),
        readNestedValue(root, ["auth", "uid"]),
        readNestedValue(root, ["auth", "member_uid"]),
        readNestedValue(root, ["auth", "memberUid"]),
    ];

    for (const candidate of candidates) {
        const parsed = toBigIntId(candidate);
        if (parsed && parsed > BigInt(0)) {
            return parsed;
        }
    }

    return null;
}

async function loadOrderGoods(
    prisma: FastifyInstance["prisma"],
    tenantId: bigint,
    orderNum: string
) {
    const goods = await prisma.mallRN_order_goods.findMany({
        where: {
            tenant_id: tenantId,
            platform_type: PLATFORM_TYPE,
            order_num: orderNum,
        },
        orderBy: [{ uid: "asc" }],
        select: {
            uid: true,
            g_uid: true,
            g_name: true,
            g_code: true,
            price: true,
            orig_price: true,
            qty: true,
            option: true,
            option_name: true,
            status: true,
            status2: true,
            signdate: true,
        },
    });

    return goods.map((row: OrderGoodsRow) => ({
        id: String(row.uid),
        productId: String(row.g_uid),
        title: toSafeString(row.g_name, "주문 상품"),
        goodsCode: toSafeString(row.g_code, ""),
        price: toInt(row.price, 0),
        origPrice: toInt(row.orig_price, 0),
        qty: toInt(row.qty, 0),
        optionId: toInt(row.option, 0),
        optionName: toSafeString(row.option_name, ""),
        status: toInt(row.status, 0),
        status2: toInt(row.status2, 0),
        createdAt: toIsoDate(row.signdate),
    }));
}

async function serializeOrder(
    prisma: FastifyInstance["prisma"],
    tenantId: bigint,
    info: OrderInfoRow
) {
    const orderNum = toSafeString(info.order_num || info.id, "");
    const items = await loadOrderGoods(prisma, tenantId, orderNum);
    const { goodsStatus, goodsStatus2 } = resolveOrderGoodsStatus(items);
    const goodsTotal = items.reduce(
        (sum, item) => sum + toInt(item.price, 0) * toInt(item.qty, 0),
        0
    );
    const totalAmount = toInt(info.pay_total, goodsTotal);

    const display = resolveCustomerOrderDisplay({
        goodsStatus,
        goodsStatus2,
        payType: toSafeString(info.pay_type, "B"),
        payStatus: toSafeString(info.pay_status, "A"),
        payInfo: toSafeString(info.pay_info, ""),
        payMethod: toSafeString(info.pay_method, ""),
        pickupAt: info.pickup_at,
    });

    const addressLine = [
        toSafeString(info.postcode, ""),
        toSafeString(info.address1, ""),
        toSafeString(info.address2, ""),
    ]
        .filter(Boolean)
        .join(" ")
        .trim();

    return {
        id: orderNum,
        orderNum,
        buyerName: toSafeString(info.name, ""),
        buyerPhone: normalizePhone(info.cell),
        receiverName: toSafeString(info.name2, ""),
        receiverPhone: normalizePhone(info.cell2),
        postcode: toSafeString(info.postcode, ""),
        address1: toSafeString(info.address1, ""),
        address2: toSafeString(info.address2, ""),
        addressLine,
        message: toSafeString(info.message, ""),
        memo: toSafeString(info.memo, ""),
        totalAmount,
        cancelTotal: toInt(info.cancel_total, 0),
        refundTotal: toInt(info.refund_total, 0),
        deliveryTotal: toInt(info.delivery_total, 0),
        payType: display.payType,
        payStatus: display.payStatus,
        payTypeLabel: display.payTypeLabel,
        payStatusLabel: display.payStatusLabel,
        isOnlinePrepaid: display.isOnlinePrepaid,
        pickupAt: info.pickup_at ? toIsoDate(info.pickup_at) : null,
        status: display.effectiveGoodsStatus,
        status2: display.goodsStatus2,
        statusLabel: display.statusLabel,
        displayStatus: display.displayStatus,
        badgeText: display.badgeText,
        footerText: display.footerText,
        canCancel: display.canCancel,
        cancelMode: display.cancelMode,
        canReturn: display.canReturn,
        canExchange: display.canExchange,
        canConfirm: display.canConfirm,
        createdAt: toIsoDate(info.signdate),
        statusDate: toIsoDate(info.status_date),
        items,
    };
}

async function listOrdersByMember(
    prisma: FastifyInstance["prisma"],
    tenantId: bigint,
    memberUid: bigint,
    take = 50
) {
    const list = await prisma.mallRN_order_info.findMany({
        where: {
            tenant_id: tenantId,
            platform_type: PLATFORM_TYPE,
            member_uid: memberUid,
        },
        orderBy: [{ signdate: "desc" }, { uid: "desc" }],
        take,
        select: ORDER_INFO_PUBLIC_SELECT,
    });

    return Promise.all(list.map((row: OrderInfoRow) => serializeOrder(prisma, tenantId, row)));
}

async function findRawOrderByMember(
    prisma: FastifyInstance["prisma"],
    tenantId: bigint,
    memberUid: bigint,
    orderNum: string
) {
    return prisma.mallRN_order_info.findFirst({
        where: {
            tenant_id: tenantId,
            platform_type: PLATFORM_TYPE,
            member_uid: memberUid,
            order_num: orderNum,
        },
        select: ORDER_INFO_PUBLIC_SELECT,
    });
}

async function findOrderByMember(
    prisma: FastifyInstance["prisma"],
    tenantId: bigint,
    memberUid: bigint,
    orderNum: string
) {
    const row = await findRawOrderByMember(prisma, tenantId, memberUid, orderNum);
    if (!row) return null;
    return serializeOrder(prisma, tenantId, row as OrderInfoRow);
}

export const publicOrderRoutes = async (fastify: FastifyInstance) => {
    const prisma = fastify.prisma;

    fastify.post<PublicOrderRoute>("/v1/orders", async (request, reply: FastifyReply) => {
        try {
            const body = request.body;
            const { tenantId, tenantSlug } = getTenantContext(request);
            const memberUid = extractAuthenticatedMemberUid(request);

            fastify.log.info(
                {
                    tenantId: tenantId ? tenantId.toString() : null,
                    tenantSlug,
                    memberUid: memberUid ? memberUid.toString() : null,
                    sessionMember: (request as any)?.session?.member ?? null,
                    cookieHeader: request.headers.cookie ?? "",
                },
                "PUBLIC_ORDER_CREATE_AUTH_DEBUG"
            );

            if (!tenantId) {
                return reply.send({
                    ok: false,
                    error: "invalid tenant",
                    message: "지점 정보가 올바르지 않습니다.",
                });
            }

            if (!memberUid) {
                return reply.code(401).send({
                    ok: false,
                    error: "login_required",
                    message: "로그인 해야 주문이 가능합니다.",
                });
            }

            // 2차 귀속 캡처(안전망): 로그인 시점에 놓친 zpzp_ref 쿠키를 주문 직전에 보정.
            // 헬퍼가 예외를 삼키므로 실패해도 주문 흐름을 막지 않는다.
            await captureRefFromRequest(fastify.prisma, Number(memberUid), (request as any).cookies ?? {});

            if (!body?.items || body.items.length === 0) {
                return reply.send({
                    ok: false,
                    error: "no items",
                    message: "주문 상품이 없습니다.",
                });
            }

            const now = toUnixNow();

            const products: Array<{
                item: PublicCreateOrderBody["items"][number];
                product: GoodsRow;
            }> = [];

            for (const item of body.items) {
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
                return reply.send({
                    ok: false,
                    error: "no valid products",
                    message: "주문 가능한 상품이 없습니다.",
                });
            }

            const subtotal = products.reduce((sum, row) => {
                return sum + toInt(row.product.price, 0) * toInt(row.item.qty, 0);
            }, 0);

            // 쿠폰 적용(W-1). 산식·스택 판정은 coupon.service 가 단일 소유. 스펙 D2/D3.
            const selection = await resolveCouponSelection(
                prisma,
                memberUid,
                subtotal,
                body.couponUids
            );
            if (!selection.ok) {
                return reply.send({
                    ok: false,
                    error: "coupon_invalid",
                    message: selection.message,
                });
            }

            const couponRows = selection.rows;
            const payTotal = subtotal - selection.discountTotal;

            const couponOwnerId = couponRows.length
                ? await resolveMemberLoginId(prisma, memberUid)
                : "";
            if (couponRows.length && !couponOwnerId) {
                return reply.send({
                    ok: false,
                    error: "coupon_owner_unresolved",
                    message: "회원 정보를 확인할 수 없습니다.",
                });
            }

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
                                tenant_id: tenantId,
                                member_uid: memberUid,
                                platform_type: PLATFORM_TYPE,
                                pickup_at: body.pickupAt ? new Date(body.pickupAt) : null,
                                order_num: orderNum,
                                name: toSafeString(body.buyerName, "주문자"),
                                cell: toSafeString(body.buyerPhone, ""),
                                email: "",
                                name2: toSafeString(body.receiverName, body.buyerName || "수령인"),
                                cell2: toSafeString(body.receiverPhone, body.buyerPhone || ""),
                                postcode: toSafeString(body.postcode, ""),
                                address1: toSafeString(body.address1, ""),
                                address2: toSafeString(body.address2, ""),
                                message: toSafeString(body.message, ""),
                                memo: toSafeString(body.memo, ""),
                                passwd: "",
                                pay_total: payTotal,
                                cancel_total: 0,
                                refund_total: 0,
                                delivery_total: 0,
                                pay_info: "",
                                pay_number: "",
                                escrow: 0,
                                bank_info: "",
                                use_mileage: 0,
                                // 장바구니 쿠폰 합계 + 대표 1장. 상세는 zpzp_order_coupon(단일 진실원).
                                use_coupon: selection.discountTotal,
                                coupon_uid: pickRepresentativeCoupon(couponRows),
                                cash_receipts: "",
                                mail_send: 0,
                                cash_issued: 0,
                                tax_issued: 0,
                                direct: body.direct ? 1 : 0,
                                new: 0,
                                sales_issued: 0,
                                mail_ok: 0,
                                reals: 0,
                                status_date: now,
                                signdate: now,
                                use_td_money: BigInt(0),
                                use_td_point: 0,
                                pay_method: "",
                            },
                        });

                        for (const row of products) {
                            await tx.mallRN_order_goods.create({
                                data: {
                                    vendor: toSafeString(row.product.vendor, tenantSlug || String(tenantId)),
                                    vendor_delivery: "",
                                    tenant_id: tenantId,
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
                                    reals: 0,
                                    signdate: now,
                                },
                            });
                        }

                        // 쿠폰 소비는 같은 트랜잭션 안에서. 동시 사용이면 throw → 주문까지 롤백.
                        await consumeCoupons(tx, couponOwnerId, couponRows, orderNum, now);
                    });

                    created = true;
                    break;
                } catch (error: unknown) {
                    if (isOrderNumUniqueError(error)) {
                        continue;
                    }
                    if (error instanceof Error && error.message.startsWith("COUPON_ALREADY_USED")) {
                        couponFailure = "이미 사용된 쿠폰입니다. 쿠폰을 다시 선택해 주세요.";
                        break;
                    }
                    throw error;
                }
            }

            if (couponFailure) {
                return reply.send({
                    ok: false,
                    error: "coupon_already_used",
                    message: couponFailure,
                });
            }

            if (!created || !orderNum) {
                return reply.send({
                    ok: false,
                    error: "order_num_conflict",
                    message: "주문번호 생성 중 충돌이 발생했습니다. 다시 시도해 주세요.",
                });
            }

            return reply.send({
                ok: true,
                orderNum,
                message: "주문이 생성되었습니다.",
            });
        } catch (error: unknown) {
            const detail = getErrorMessage(error, "주문 생성 중 오류가 발생했습니다.");
            fastify.log.error(error, "ORDER_CREATE_ERROR");

            return reply.send({
                ok: false,
                error: "order create failed",
                detail,
                message: detail,
            });
        }
    });


    fastify.get(
        "/v1/orders/recent",
        async (
            request: FastifyRequest<{
                Querystring: { take?: number | string };
            }>,
            reply: FastifyReply
        ) => {
            try {
                const { tenantId } = getTenantContext(request as unknown as FastifyRequest<PublicOrderRoute>);
                const take = Math.min(Math.max(toInt(request.query?.take, 10), 1), 20);

                if (!tenantId) {
                    return reply.code(400).send({
                        ok: false,
                        error: "invalid_tenant",
                        message: "지점 정보가 올바르지 않습니다.",
                    });
                }

                const rows = await prisma.mallRN_order_info.findMany({
                    where: {
                        tenant_id: tenantId,
                        platform_type: PLATFORM_TYPE,
                        pay_status: {
                            in: ["A", "B", "D"],
                        },
                    },
                    orderBy: [{ signdate: "desc" }, { uid: "desc" }],
                    take,
                    select: {
                        order_num: true,
                        name: true,
                        signdate: true,
                    },
                });

                if (!rows.length) {
                    return reply.send({
                        ok: true,
                        items: [],
                    });
                }

                const orderNums = rows.map((row) => row.order_num).filter(Boolean);

                const orderGoods = orderNums.length
                    ? await prisma.mallRN_order_goods.findMany({
                        where: {
                            tenant_id: tenantId,
                            platform_type: PLATFORM_TYPE,
                            order_num: { in: orderNums },
                            status: { not: STATUS_CANCELED },
                        },
                        select: {
                            order_num: true,
                            qty: true,
                        },
                    })
                    : [];

                const qtyMap = new Map<string, number>();
                for (const item of orderGoods) {
                    const orderNum = toSafeString(item.order_num, "");
                    if (!orderNum) continue;

                    qtyMap.set(orderNum, (qtyMap.get(orderNum) ?? 0) + Math.max(0, toInt(item.qty, 0)));
                }

                const items = rows.map((row) => {
                    const orderNum = toSafeString(row.order_num, "");
                    return {
                        id: orderNum,
                        maskedName: maskBuyerName(row.name),
                        minutesAgo: minutesAgoFromUnix(row.signdate),
                        qty: Math.max(1, qtyMap.get(orderNum) ?? 0),
                    };
                });

                return reply.send({
                    ok: true,
                    items,
                });
            } catch (error: unknown) {
                const detail = getErrorMessage(error, "최근 주문 조회 중 오류가 발생했습니다.");
                fastify.log.error(error, "ORDER_RECENT_LIST_ERROR");

                return reply.code(500).send({
                    ok: false,
                    error: "recent orders failed",
                    detail,
                    message: detail,
                });
            }
        }
    );

    // ⚠️ 접근제어(2026-07-20): 이 라우트는 테넌트 최근 주문 50건을 반환하며 응답에
    // buyerName/buyerPhone/receiverName/receiverPhone/message/memo/금액/상품내역 등
    // 개인정보가 포함된다. 기존에는 인증 없이(requireTenant만) 누구나 조회 가능했고
    // 프론트에도 호출자가 없는 고아 라우트였으므로 관리자 인증 뒤로 이동한다.
    // (고객 본인 주문은 /v1/orders/me, 비회원은 /v1/orders/guest/*, 셀러는 /v1/seller/orders 사용)
    fastify.get("/v1/orders", { preHandler: requireAdmin() }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { tenantId } = getTenantContext(request as FastifyRequest<PublicOrderRoute>);

            if (!tenantId) {
                return reply.send({
                    ok: false,
                    error: "invalid tenant",
                    message: "지점 정보가 올바르지 않습니다.",
                });
            }

            const list = await prisma.mallRN_order_info.findMany({
                where: {
                    tenant_id: tenantId,
                    platform_type: PLATFORM_TYPE,
                },
                orderBy: [{ signdate: "desc" }, { uid: "desc" }],
                take: 50,
                select: ORDER_INFO_PUBLIC_SELECT,
            });

            const items = await Promise.all(
                list.map((row: OrderInfoRow) => serializeOrder(prisma, tenantId, row))
            );

            return reply.send({
                ok: true,
                items,
            });
        } catch (error: unknown) {
            const detail = getErrorMessage(error, "주문 목록 조회 중 오류가 발생했습니다.");
            fastify.log.error(error, "ORDER_LIST_ERROR");

            return reply.send({
                ok: false,
                error: "order list failed",
                detail,
                message: detail,
            });
        }
    });

    fastify.get("/v1/orders/me", async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { tenantId, tenantSlug } = getTenantContext(request as FastifyRequest<PublicOrderRoute>);
            const memberUid = extractAuthenticatedMemberUid(request);

            fastify.log.info(
                {
                    tenantId: tenantId ? tenantId.toString() : null,
                    tenantSlug,
                    memberUid: memberUid ? memberUid.toString() : null,
                    sessionMember: (request as any)?.session?.member ?? null,
                },
                "PUBLIC_ORDER_ME_DEBUG"
            );

            if (!tenantId) {
                return reply.code(400).send({
                    ok: false,
                    error: "invalid_tenant",
                    message: "지점 정보가 올바르지 않습니다.",
                });
            }

            if (!memberUid) {
                return reply.code(401).send({
                    ok: false,
                    error: "not_logged_in",
                    message: "로그인이 필요합니다.",
                });
            }

            const items = await listOrdersByMember(prisma, tenantId, memberUid, 50);

            return reply.send({
                ok: true,
                items,
            });
        } catch (error: unknown) {
            const detail = getErrorMessage(error, "내 주문 목록 조회 중 오류가 발생했습니다.");
            fastify.log.error(error, "ORDER_ME_LIST_ERROR");

            return reply.code(500).send({
                ok: false,
                error: "order me failed",
                detail,
                message: detail,
            });
        }
    });

    fastify.post(
        "/v1/orders/guest/list",
        async (
            request: FastifyRequest<{ Body: GuestOrderListBody; Params: { tenant?: string } }>,
            reply: FastifyReply
        ) => {
            try {
                const { tenantId } = getTenantContext(
                    request as unknown as FastifyRequest<PublicOrderRoute>
                );
                const phone = normalizePhone(request.body?.phone);
                const orderNums = Array.isArray(request.body?.orderNums)
                    ? request.body.orderNums.map((v) => String(v).trim()).filter(Boolean)
                    : [];

                if (!tenantId) {
                    return reply.send({
                        ok: false,
                        error: "invalid tenant",
                        message: "지점 정보가 올바르지 않습니다.",
                    });
                }

                const candidates = await prisma.mallRN_order_info.findMany({
                    where: {
                        tenant_id: tenantId,
                        platform_type: PLATFORM_TYPE,
                        ...(orderNums.length > 0 ? { order_num: { in: orderNums } } : {}),
                    },
                    orderBy: [{ signdate: "desc" }, { uid: "desc" }],
                    take: orderNums.length > 0 ? Math.max(orderNums.length, 50) : 50,
                    select: ORDER_INFO_PUBLIC_SELECT,
                });

                const filtered = candidates.filter((row: OrderInfoRow) => {
                    const rowPhone = normalizePhone(row.cell);
                    if (phone && rowPhone === phone) return true;
                    if (orderNums.length > 0 && orderNums.includes(String(row.order_num || ""))) return true;
                    return false;
                });

                const items = await Promise.all(
                    filtered.map((row: OrderInfoRow) => serializeOrder(prisma, tenantId, row))
                );

                return reply.send({
                    ok: true,
                    items,
                });
            } catch (error: unknown) {
                const detail = getErrorMessage(error, "비회원 주문 목록 조회 중 오류가 발생했습니다.");
                fastify.log.error(error, "GUEST_ORDER_LIST_ERROR");

                return reply.send({
                    ok: false,
                    error: "guest order list failed",
                    detail,
                    message: detail,
                });
            }
        }
    );

    fastify.get(
        "/v1/orders/guest/:orderNum",
        async (
            request: FastifyRequest<{
                Params: { tenant?: string; orderNum: string };
                Querystring: { phone?: string };
            }>,
            reply: FastifyReply
        ) => {
            try {
                const { tenantId } = getTenantContext(
                    request as unknown as FastifyRequest<PublicOrderRoute>
                );
                const orderNum = toSafeString(request.params?.orderNum, "");
                const phone = normalizePhone(request.query?.phone);

                if (!tenantId || !orderNum) {
                    return reply.code(400).send({
                        ok: false,
                        error: "invalid_request",
                        message: "요청 정보가 올바르지 않습니다.",
                    });
                }

                const row = await prisma.mallRN_order_info.findFirst({
                    where: {
                        tenant_id: tenantId,
                        platform_type: PLATFORM_TYPE,
                        order_num: orderNum,
                    },
                    select: ORDER_INFO_PUBLIC_SELECT,
                });

                if (!row) {
                    return reply.code(404).send({
                        ok: false,
                        error: "not_found",
                        message: "주문을 찾을 수 없습니다.",
                    });
                }

                const rowPhone = normalizePhone(row.cell);
                if (!phone || rowPhone !== phone) {
                    return reply.code(403).send({
                        ok: false,
                        error: "forbidden",
                        message: "주문 조회 권한이 없습니다.",
                    });
                }

                const order = await serializeOrder(prisma, tenantId, row as OrderInfoRow);

                return reply.send({
                    ok: true,
                    order,
                });
            } catch (error: unknown) {
                const detail = getErrorMessage(error, "비회원 주문 상세 조회 중 오류가 발생했습니다.");
                fastify.log.error(error, "GUEST_ORDER_DETAIL_ERROR");

                return reply.code(500).send({
                    ok: false,
                    error: "guest order detail failed",
                    detail,
                    message: detail,
                });
            }
        }
    );

    fastify.post(
        "/v1/orders/guest/:orderNum/cancel",
        async (
            request: FastifyRequest<{
                Params: { tenant?: string; orderNum: string };
                Body: GuestOrderCancelBody;
            }>,
            reply: FastifyReply
        ) => {
            try {
                const { tenantId } = getTenantContext(
                    request as unknown as FastifyRequest<PublicOrderRoute>
                );
                const orderNum = toSafeString(request.params?.orderNum, "");
                const phone = normalizePhone(request.body?.phone);
                const now = toUnixNow();

                if (!tenantId || !orderNum || !phone) {
                    return reply.code(400).send({
                        ok: false,
                        error: "invalid_request",
                        message: "주문취소 요청 정보가 올바르지 않습니다.",
                    });
                }

                const row = await prisma.mallRN_order_info.findFirst({
                    where: {
                        tenant_id: tenantId,
                        platform_type: PLATFORM_TYPE,
                        order_num: orderNum,
                    },
                    select: ORDER_INFO_PUBLIC_SELECT,
                });

                if (!row) {
                    return reply.code(404).send({
                        ok: false,
                        error: "not_found",
                        message: "주문을 찾을 수 없습니다.",
                    });
                }

                if (normalizePhone(row.cell) !== phone) {
                    return reply.code(403).send({
                        ok: false,
                        error: "forbidden",
                        message: "주문취소 권한이 없습니다.",
                    });
                }

                const { goodsStatus, goodsStatus2 } = await readOrderGoodsStatus(
                    prisma,
                    tenantId,
                    orderNum
                );
                const cancelDisplay = resolveCustomerOrderDisplay({
                    goodsStatus,
                    goodsStatus2,
                    payType: toSafeString(row.pay_type, "B"),
                    payStatus: toSafeString(row.pay_status, "A"),
                    payInfo: toSafeString(row.pay_info, ""),
                    payMethod: toSafeString(row.pay_method, ""),
                    pickupAt: row.pickup_at,
                });

                if (!cancelDisplay.canCancel) {
                    return reply.code(400).send({
                        ok: false,
                        error: "cannot_cancel",
                        message: "현재 상태에서는 주문취소가 불가능합니다.",
                    });
                }

                const cancelResult = await executeCustomerImmediateCancel({
                    prisma,
                    tenantId,
                    orderNum,
                    orderRow: row,
                    cancelDisplay,
                    actorRole: "guest",
                    actorNickname: toSafeString(row.name, "비회원"),
                    now,
                });

                if (!cancelResult.ok) {
                    return reply.code(502).send({
                        ok: false,
                        error: cancelResult.code,
                        message: cancelResult.message,
                    });
                }

                return reply.send({
                    ok: true,
                    orderNum,
                    status: STATUS_CANCELED,
                    statusLabel: buildGoodsStatusLabel(STATUS_CANCELED, 0),
                    message: "주문이 취소되었습니다.",
                });
            } catch (error: unknown) {
                const detail = getErrorMessage(error, "비회원 주문취소 중 오류가 발생했습니다.");
                fastify.log.error(error, "GUEST_ORDER_CANCEL_ERROR");

                return reply.code(500).send({
                    ok: false,
                    error: "guest order cancel failed",
                    detail,
                    message: detail,
                });
            }
        }
    );

    fastify.post(
        "/v1/orders/:orderNum/cancel",
        async (
            request: FastifyRequest<{
                Params: { tenant?: string; orderNum: string };
            }>,
            reply: FastifyReply
        ) => {
            try {
                const { tenantId, tenantSlug } = getTenantContext(
                    request as unknown as FastifyRequest<PublicOrderRoute>
                );
                const memberUid = extractAuthenticatedMemberUid(request);
                const orderNum = toSafeString(request.params?.orderNum, "");
                const now = toUnixNow();

                fastify.log.info(
                    {
                        tenantId: tenantId ? tenantId.toString() : null,
                        tenantSlug,
                        memberUid: memberUid ? memberUid.toString() : null,
                        orderNum,
                        sessionMember: (request as any)?.session?.member ?? null,
                    },
                    "PUBLIC_ORDER_CANCEL_AUTH_DEBUG"
                );

                if (!tenantId || !orderNum) {
                    return reply.code(400).send({
                        ok: false,
                        error: "invalid_request",
                        message: "요청 정보가 올바르지 않습니다.",
                    });
                }

                if (!memberUid) {
                    return reply.code(401).send({
                        ok: false,
                        error: "not_logged_in",
                        message: "로그인이 필요합니다.",
                    });
                }

                const rawOrder = await findRawOrderByMember(prisma, tenantId, memberUid, orderNum);

                if (!rawOrder) {
                    return reply.code(404).send({
                        ok: false,
                        error: "not_found",
                        message: "주문을 찾을 수 없습니다.",
                    });
                }

                const { goodsStatus, goodsStatus2 } = await readOrderGoodsStatus(
                    prisma,
                    tenantId,
                    orderNum
                );
                const cancelDisplay = resolveCustomerOrderDisplay({
                    goodsStatus,
                    goodsStatus2,
                    payType: toSafeString(rawOrder.pay_type, "B"),
                    payStatus: toSafeString(rawOrder.pay_status, "A"),
                    payInfo: toSafeString(rawOrder.pay_info, ""),
                    payMethod: toSafeString(rawOrder.pay_method, ""),
                    pickupAt: rawOrder.pickup_at,
                });

                if (!cancelDisplay.canCancel) {
                    return reply.code(400).send({
                        ok: false,
                        error: "cannot_cancel",
                        message: "현재 상태에서는 주문취소가 불가능합니다.",
                    });
                }

                const memberRow = await prisma.mallRN_member.findFirst({
                    where: { uid: Number(memberUid) },
                    select: { name: true },
                });
                const actorNickname = toSafeString(
                    memberRow?.name || rawOrder.name,
                    "회원"
                );

                const cancelResult = await executeCustomerImmediateCancel({
                    prisma,
                    tenantId,
                    orderNum,
                    orderRow: rawOrder,
                    cancelDisplay,
                    actorRole: "member",
                    actorMemberUid: memberUid,
                    actorNickname,
                    now,
                });

                if (!cancelResult.ok) {
                    return reply.code(502).send({
                        ok: false,
                        error: cancelResult.code,
                        message: cancelResult.message,
                    });
                }

                return reply.send({
                    ok: true,
                    orderNum,
                    status: STATUS_CANCELED,
                    statusLabel: buildGoodsStatusLabel(STATUS_CANCELED, 0),
                    message: "주문이 취소되었습니다.",
                });
            } catch (error: unknown) {
                const detail = getErrorMessage(error, "로그인 주문취소 중 오류가 발생했습니다.");
                fastify.log.error(error, "ORDER_CANCEL_ERROR");

                return reply.code(500).send({
                    ok: false,
                    error: "order cancel failed",
                    detail,
                    message: detail,
                });
            }
        }
    );

    fastify.get(
        "/v1/orders/:orderNum",
        async (
            request: FastifyRequest<{
                Params: { tenant?: string; orderNum: string };
            }>,
            reply: FastifyReply
        ) => {
            try {
                const { tenantId, tenantSlug } = getTenantContext(
                    request as unknown as FastifyRequest<PublicOrderRoute>
                );
                const memberUid = extractAuthenticatedMemberUid(request);
                const orderNum = toSafeString(request.params?.orderNum, "");

                fastify.log.info(
                    {
                        tenantId: tenantId ? tenantId.toString() : null,
                        tenantSlug,
                        memberUid: memberUid ? memberUid.toString() : null,
                        orderNum,
                        sessionMember: (request as any)?.session?.member ?? null,
                    },
                    "PUBLIC_ORDER_DETAIL_AUTH_DEBUG"
                );

                if (!tenantId || !orderNum) {
                    return reply.code(400).send({
                        ok: false,
                        error: "invalid_request",
                        message: "요청 정보가 올바르지 않습니다.",
                    });
                }

                if (!memberUid) {
                    return reply.code(401).send({
                        ok: false,
                        error: "not_logged_in",
                        message: "로그인이 필요합니다.",
                    });
                }

                const order = await findOrderByMember(prisma, tenantId, memberUid, orderNum);

                if (!order) {
                    return reply.code(404).send({
                        ok: false,
                        error: "not_found",
                        message: "주문을 찾을 수 없습니다.",
                    });
                }

                return reply.send({
                    ok: true,
                    order,
                });
            } catch (error: unknown) {
                const detail = getErrorMessage(error, "로그인 주문 상세 조회 중 오류가 발생했습니다.");
                fastify.log.error(error, "ORDER_DETAIL_ERROR");

                return reply.code(500).send({
                    ok: false,
                    error: "order detail failed",
                    detail,
                    message: detail,
                });
            }
        }
    );

    fastify.post<{
        Body: { type?: "return" | "exchange"; reason?: string };
        Params: { tenant?: string; orderNum: string };
    }>("/v1/orders/:orderNum/claim", async (request, reply: FastifyReply) => {
        try {
            const { tenantId } = getTenantContext(
                request as unknown as FastifyRequest<PublicOrderRoute>
            );
            const memberUid = extractAuthenticatedMemberUid(request);
            const orderNum = toSafeString(request.params?.orderNum, "");
            const claimType = toSafeString(request.body?.type, "");
            const reason = toSafeString(request.body?.reason, "");
            const now = toUnixNow();

            if (!tenantId || !orderNum) {
                return reply.code(400).send({
                    ok: false,
                    message: "요청 정보가 올바르지 않습니다.",
                });
            }

            if (!memberUid) {
                return reply.code(401).send({
                    ok: false,
                    message: "로그인이 필요합니다.",
                });
            }

            if (claimType !== "return" && claimType !== "exchange") {
                return reply.code(400).send({
                    ok: false,
                    message: "요청 유형이 올바르지 않습니다.",
                });
            }

            const rawOrder = await findRawOrderByMember(prisma, tenantId, memberUid, orderNum);
            if (!rawOrder) {
                return reply.code(404).send({
                    ok: false,
                    message: "주문을 찾을 수 없습니다.",
                });
            }

            const { goodsStatus, goodsStatus2 } = await readOrderGoodsStatus(
                prisma,
                tenantId,
                orderNum
            );
            const display = resolveCustomerOrderDisplay({
                goodsStatus,
                goodsStatus2,
                payType: toSafeString(rawOrder.pay_type, "B"),
                payStatus: toSafeString(rawOrder.pay_status, "A"),
                payInfo: toSafeString(rawOrder.pay_info, ""),
                payMethod: toSafeString(rawOrder.pay_method, ""),
                pickupAt: rawOrder.pickup_at,
            });

            const allowed =
                claimType === "return" ? display.canReturn : display.canExchange;
            if (!allowed) {
                return reply.code(400).send({
                    ok: false,
                    message: "현재 상태에서는 요청할 수 없습니다.",
                });
            }

            const nextStatus = claimType === "return" ? STATUS_RETURN : STATUS_EXCHANGE;
            const memberRow = await prisma.mallRN_member.findFirst({
                where: { uid: Number(memberUid) },
                select: { name: true, id: true },
            });
            const actorNickname = toSafeString(memberRow?.name || rawOrder.name, "회원");
            const claimReason = reason || (claimType === "return" ? "반품 요청" : "교환 요청");

            const claimGoodsRows = await prisma.mallRN_order_goods.findMany({
                where: {
                    tenant_id: tenantId,
                    platform_type: PLATFORM_TYPE,
                    order_num: orderNum,
                    reals: 1,
                },
                select: {
                    uid: true,
                    vendor: true,
                    status: true,
                    status2: true,
                },
            });

            await prisma.$transaction(async (tx: any) => {
                await tx.mallRN_order_info.updateMany({
                    where: {
                        tenant_id: tenantId,
                        platform_type: PLATFORM_TYPE,
                        order_num: orderNum,
                    },
                    data: { status_date: now },
                });

                await tx.mallRN_order_goods.updateMany({
                    where: {
                        tenant_id: tenantId,
                        platform_type: PLATFORM_TYPE,
                        order_num: orderNum,
                    },
                    data: {
                        status: nextStatus,
                        status2: STATUS2_REQUEST,
                        status_date: now,
                    },
                });

                await writeClaimStatusChangeRecords(
                    tx,
                    claimGoodsRows.map((row: ClaimGoodsRow) => ({
                        uid: Number(row.uid),
                        vendor: toSafeString(row.vendor, ""),
                        status: toInt(row.status, 0),
                        status2: toInt(row.status2, 0),
                    })),
                    {
                        orderNum,
                        memberId: toSafeString(memberRow?.id || rawOrder.id, ""),
                        memberName: actorNickname,
                        claimStatus: nextStatus,
                        reason: claimReason,
                        now,
                    }
                );

                await writeOrderActionLog(tx, {
                    tenantId,
                    eventType: "cancel",
                    orderNum,
                    actorRole: "member",
                    actorMemberUid: memberUid,
                    actorNickname,
                    beforeStatus: display.effectiveGoodsStatus,
                    afterStatus: nextStatus,
                    reason: claimReason,
                    metaJson: JSON.stringify({ claimType }),
                });
            });

            // 트랜잭션 성공 직후 타이머 정지. 비치명이라 await 하되 실패해도 응답은 성공.
            await pauseConfirmTimersForClaim(fastify, {
                orderNum,
                goodsUids: claimGoodsRows.map((row: ClaimGoodsRow) => Number(row.uid)),
                reason: claimType === "return" ? "return" : "exchange",
            });

            const statusLabel = buildGoodsStatusLabel(nextStatus, STATUS2_REQUEST);

            return reply.send({
                ok: true,
                orderNum,
                status: nextStatus,
                status2: STATUS2_REQUEST,
                statusLabel,
                message:
                    claimType === "return"
                        ? "반품 요청이 접수되었습니다."
                        : "교환 요청이 접수되었습니다.",
            });
        } catch (error: unknown) {
            const detail = getErrorMessage(error, "교환·반품 요청 중 오류가 발생했습니다.");
            fastify.log.error(error, "ORDER_CLAIM_ERROR");
            return reply.code(500).send({
                ok: false,
                message: detail,
            });
        }
    });

    fastify.post<{ Params: { tenant?: string; orderNum: string } }>(
        "/v1/orders/:orderNum/confirm",
        async (request, reply: FastifyReply) => {
            try {
                const { tenantId } = getTenantContext(
                    request as unknown as FastifyRequest<PublicOrderRoute>
                );
                const memberUid = extractAuthenticatedMemberUid(request);
                const orderNum = toSafeString(request.params?.orderNum, "");

                if (!tenantId || !orderNum) {
                    return reply.code(400).send({
                        ok: false,
                        message: "요청 정보가 올바르지 않습니다.",
                    });
                }

                if (!memberUid) {
                    return reply.code(401).send({
                        ok: false,
                        message: "로그인이 필요합니다.",
                    });
                }

                const rawOrder = await findRawOrderByMember(prisma, tenantId, memberUid, orderNum);
                if (!rawOrder) {
                    return reply.code(404).send({
                        ok: false,
                        message: "주문을 찾을 수 없습니다.",
                    });
                }

                const { goodsStatus, goodsStatus2 } = await readOrderGoodsStatus(
                    prisma,
                    tenantId,
                    orderNum
                );
                const display = resolveCustomerOrderDisplay({
                    goodsStatus,
                    goodsStatus2,
                    payType: toSafeString(rawOrder.pay_type, "B"),
                    payStatus: toSafeString(rawOrder.pay_status, "A"),
                    payInfo: toSafeString(rawOrder.pay_info, ""),
                    payMethod: toSafeString(rawOrder.pay_method, ""),
                    pickupAt: rawOrder.pickup_at,
                });

                if (!display.canConfirm) {
                    return reply.code(400).send({
                        ok: false,
                        message: "배송완료 상태에서만 구매확정할 수 있습니다.",
                    });
                }

                const bridge = await callPhpBridge<{
                    confirmed?: number;
                    status?: number;
                    status2?: number;
                    statusLabel?: string;
                    orderNum?: string;
                }>("/php/order_confirm_api.php", {
                    action: "confirm_order",
                    member_uid: Number(memberUid),
                    order_num: orderNum,
                });

                if (!bridge.ok || !bridge.data?.confirmed) {
                    return reply.code(bridge.transportFailed ? 502 : 400).send({
                        ok: false,
                        message:
                            bridge.message ||
                            "구매확정 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.",
                    });
                }

                return reply.send({
                    ok: true,
                    orderNum,
                    status: toInt(bridge.data.status, 5),
                    status2: toInt(bridge.data.status2, 0),
                    statusLabel: toSafeString(bridge.data.statusLabel, "구매확정"),
                    message: bridge.message || "구매확정이 완료되었습니다.",
                });
            } catch (error: unknown) {
                const detail = getErrorMessage(error, "구매확정 처리 중 오류가 발생했습니다.");
                fastify.log.error(error, "ORDER_CONFIRM_ERROR");
                return reply.code(500).send({
                    ok: false,
                    message: detail,
                });
            }
        }
    );
};