// apps/api/src/modules/public/orders.routes.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { captureRefFromRequest } from "../attribution/capture.js";

const PLATFORM_TYPE = "DAD";
const STATUS_ORDERED = 0;
const STATUS_CANCELED = 9;

type PublicCreateOrderBody = {
    buyerName?: string;
    buyerPhone?: string;
    receiverName?: string;
    receiverPhone?: string;
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
    pay_method: string;
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

function formatPickupBadge(pickupAt: Date | null): string | null {
    if (!pickupAt) return null;

    const d = pickupAt instanceof Date ? pickupAt : new Date(pickupAt);
    if (Number.isNaN(d.getTime())) return null;

    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `픽업 예정 ${mm}/${dd}`;
}

function getStatusLabel(status: number): string {
    if (status === STATUS_CANCELED) return "주문취소";
    return "주문접수";
}

function getFooterText(status: number, pickupAt: Date | null): string {
    if (status === STATUS_CANCELED) return "주문이 취소되었습니다.";
    if (pickupAt) return "매장 방문 시 수령 가능";
    return "주문이 접수되었습니다.";
}

const STATUS_PICKUP_READY = 2;
const STATUS_PICKUP_DONE = 4;

// 고객 취소 가능 조건:
//   - 픽업완료(4) 이전 상태 (status < 4)
//   - 공구 마감(sale_end_at) 이전. saleEndAt이 null이면 마감 없음으로 간주
function canCustomerCancel(status: number, saleEndAt: Date | null): boolean {
    if (status >= STATUS_PICKUP_DONE) return false;
    if (status === STATUS_CANCELED) return false;
    if (saleEndAt && saleEndAt.getTime() <= Date.now()) return false;
    return true;
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
    const firstItemStatus = items[0]?.status2 ?? items[0]?.status ?? STATUS_ORDERED;
    const status = toInt(firstItemStatus, 0);
    const goodsTotal = items.reduce(
        (sum, item) => sum + toInt(item.price, 0) * toInt(item.qty, 0),
        0
    );
    const totalAmount = toInt(info.pay_total, goodsTotal);

    const saleEndAt = await getStrictestSaleEndAt(prisma, tenantId, orderNum);
    const pickupDateText = await getOrderPickupText(prisma, tenantId, orderNum);

    return {
        id: orderNum,
        orderNum,
        buyerName: toSafeString(info.name, ""),
        buyerPhone: normalizePhone(info.cell),
        receiverName: toSafeString(info.name2, ""),
        receiverPhone: normalizePhone(info.cell2),
        message: toSafeString(info.message, ""),
        memo: toSafeString(info.memo, ""),
        totalAmount,
        cancelTotal: toInt(info.cancel_total, 0),
        refundTotal: toInt(info.refund_total, 0),
        deliveryTotal: toInt(info.delivery_total, 0),
        payType: "offline",
        payStatus: "pending",
        pickupAt: info.pickup_at ? toIsoDate(info.pickup_at) : null,
        pickupDateText,
        status,
        statusLabel: getStatusLabel(status),
        displayStatus: getStatusLabel(status),
        badgeText: formatPickupBadge(info.pickup_at),
        footerText: getFooterText(status, info.pickup_at),
        canCancel: canCustomerCancel(status, saleEndAt),
        saleEndAt: saleEndAt ? saleEndAt.toISOString() : null,
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
        select: {
            uid: true,
            id: true,
            order_num: true,
            name: true,
            cell: true,
            name2: true,
            cell2: true,
            message: true,
            memo: true,
            pay_total: true,
            cancel_total: true,
            refund_total: true,
            delivery_total: true,
            pay_method: true,
            pickup_at: true,
            status_date: true,
            signdate: true,
            member_uid: true,
        },
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
        select: {
            uid: true,
            id: true,
            order_num: true,
            name: true,
            cell: true,
            name2: true,
            cell2: true,
            message: true,
            memo: true,
            pay_total: true,
            cancel_total: true,
            refund_total: true,
            delivery_total: true,
            pay_method: true,
            pickup_at: true,
            status_date: true,
            signdate: true,
            member_uid: true,
        },
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

            const payTotal = products.reduce((sum, row) => {
                return sum + toInt(row.product.price, 0) * toInt(row.item.qty, 0);
            }, 0);

            let orderNum = "";
            let created = false;

            for (let attempt = 0; attempt < 5; attempt += 1) {
                orderNum = buildOrderNum();

                try {
                    const txOps = [
                        prisma.mallRN_order_info.create({
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
                                postcode: "",
                                address1: "",
                                address2: "",
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
                                use_coupon: 0,
                                coupon_uid: 0,
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
                        }),
                        ...products.map((row) =>
                            prisma.mallRN_order_goods.create({
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
                            })
                        ),
                    ];

                    await prisma.$transaction(txOps);
                    created = true;
                    break;
                } catch (error: unknown) {
                    if (isOrderNumUniqueError(error)) {
                        continue;
                    }
                    throw error;
                }
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

    fastify.get("/v1/orders", async (request: FastifyRequest, reply: FastifyReply) => {
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
                select: {
                    uid: true,
                    id: true,
                    order_num: true,
                    name: true,
                    cell: true,
                    name2: true,
                    cell2: true,
                    message: true,
                    memo: true,
                    pay_total: true,
                    cancel_total: true,
                    refund_total: true,
                    delivery_total: true,
                    pay_method: true,
                    pickup_at: true,
                    status_date: true,
                    signdate: true,
                    member_uid: true,
                },
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
                    select: {
                        uid: true,
                        id: true,
                        order_num: true,
                        name: true,
                        cell: true,
                        name2: true,
                        cell2: true,
                        message: true,
                        memo: true,
                        pay_total: true,
                        cancel_total: true,
                        refund_total: true,
                        delivery_total: true,
                        pay_method: true,
                        pickup_at: true,
                        status_date: true,
                        signdate: true,
                        member_uid: true,
                    },
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
                    select: {
                        uid: true,
                        id: true,
                        order_num: true,
                        name: true,
                        cell: true,
                        name2: true,
                        cell2: true,
                        message: true,
                        memo: true,
                        pay_total: true,
                        cancel_total: true,
                        refund_total: true,
                        delivery_total: true,
                        pay_method: true,
                        pickup_at: true,
                        status_date: true,
                        signdate: true,
                        member_uid: true,
                    },
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
                    select: {
                        uid: true,
                        id: true,
                        order_num: true,
                        name: true,
                        cell: true,
                        name2: true,
                        cell2: true,
                        message: true,
                        memo: true,
                        pay_total: true,
                        cancel_total: true,
                        refund_total: true,
                        delivery_total: true,
                        pay_method: true,
                        pickup_at: true,
                        status_date: true,
                        signdate: true,
                        member_uid: true,
                    },
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

                const goodsRows = await prisma.mallRN_order_goods.findMany({
                    where: {
                        tenant_id: tenantId,
                        platform_type: PLATFORM_TYPE,
                        order_num: orderNum,
                    },
                    select: {
                        status: true,
                        status2: true,
                    },
                    take: 1,
                });

                const currentStatus = toInt(goodsRows[0]?.status2 ?? goodsRows[0]?.status, 0);
                const saleEndAt = await getStrictestSaleEndAt(prisma, tenantId, orderNum);

                if (!canCustomerCancel(currentStatus, saleEndAt)) {
                    const expired = !!(saleEndAt && saleEndAt.getTime() <= Date.now());
                    return reply.code(400).send({
                        ok: false,
                        error: expired ? "groupbuy_closed" : "cannot_cancel",
                        message: expired
                            ? "공구가 마감되어 주문취소가 불가능합니다."
                            : "현재 상태에서는 주문취소가 불가능합니다.",
                    });
                }

                await prisma.$transaction(async (tx: any) => {
                    await tx.mallRN_order_info.updateMany({
                        where: {
                            tenant_id: tenantId,
                            platform_type: PLATFORM_TYPE,
                            order_num: orderNum,
                        },
                        data: {
                            status_date: now,
                        },
                    });

                    await tx.mallRN_order_goods.updateMany({
                        where: {
                            tenant_id: tenantId,
                            platform_type: PLATFORM_TYPE,
                            order_num: orderNum,
                        },
                        data: {
                            status: STATUS_CANCELED,
                            status2: STATUS_CANCELED,
                            status_date: now,
                        },
                    });

                    await writeOrderActionLog(tx, {
                        tenantId,
                        eventType: "cancel",
                        orderNum,
                        actorRole: "guest",
                        actorMemberUid: null,
                        actorNickname: toSafeString(row.name, "비회원"),
                        beforeStatus: currentStatus,
                        afterStatus: STATUS_CANCELED,
                    });
                });

                return reply.send({
                    ok: true,
                    orderNum,
                    status: STATUS_CANCELED,
                    statusLabel: getStatusLabel(STATUS_CANCELED),
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

                const goodsRows = await prisma.mallRN_order_goods.findMany({
                    where: {
                        tenant_id: tenantId,
                        platform_type: PLATFORM_TYPE,
                        order_num: orderNum,
                    },
                    select: {
                        status: true,
                        status2: true,
                    },
                    take: 1,
                });

                const currentStatus = toInt(goodsRows[0]?.status2 ?? goodsRows[0]?.status, 0);
                const saleEndAt = await getStrictestSaleEndAt(prisma, tenantId, orderNum);

                if (!canCustomerCancel(currentStatus, saleEndAt)) {
                    const expired = !!(saleEndAt && saleEndAt.getTime() <= Date.now());
                    return reply.code(400).send({
                        ok: false,
                        error: expired ? "groupbuy_closed" : "cannot_cancel",
                        message: expired
                            ? "공구가 마감되어 주문취소가 불가능합니다."
                            : "현재 상태에서는 주문취소가 불가능합니다.",
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

                await prisma.$transaction(async (tx: any) => {
                    await tx.mallRN_order_info.updateMany({
                        where: {
                            tenant_id: tenantId,
                            platform_type: PLATFORM_TYPE,
                            member_uid: memberUid,
                            order_num: orderNum,
                        },
                        data: {
                            status_date: now,
                        },
                    });

                    await tx.mallRN_order_goods.updateMany({
                        where: {
                            tenant_id: tenantId,
                            platform_type: PLATFORM_TYPE,
                            order_num: orderNum,
                        },
                        data: {
                            status: STATUS_CANCELED,
                            status2: STATUS_CANCELED,
                            status_date: now,
                        },
                    });

                    await writeOrderActionLog(tx, {
                        tenantId,
                        eventType: "cancel",
                        orderNum,
                        actorRole: "member",
                        actorMemberUid: memberUid,
                        actorNickname,
                        beforeStatus: currentStatus,
                        afterStatus: STATUS_CANCELED,
                    });
                });

                return reply.send({
                    ok: true,
                    orderNum,
                    status: STATUS_CANCELED,
                    statusLabel: getStatusLabel(STATUS_CANCELED),
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
};