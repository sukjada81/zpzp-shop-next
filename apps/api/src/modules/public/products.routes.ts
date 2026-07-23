// apps/api/src/modules/public/products.routes.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireTenant } from "../../common/guard.js";

type ImageItem = { key: string; label?: string };

type PublicOptionItem = {
    id: string;
    name: string;
    price: number | null;
    addPrice?: number;
    qty?: number;
    qtyType?: number;
    soldout?: boolean;
    stockNote?: string;
    rawOptionId?: number;
    code?: string;
};

const HQ_TENANT_ID = BigInt(0);
const CATE_DAILY_DEAL = BigInt(100000);
const CATE_PICKUP_READY = BigInt(100001);

function toId(v: bigint | number | string): string {
    if (typeof v === "bigint") return v.toString();
    return String(v);
}

function toNumber(v: unknown, fallback = 0): number {
    if (v == null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

// 비회원 가격 마스킹 (기획서 §8 — 비회원 가격 노출 차단)
// 폐쇄몰이라 비로그인 요청에는 실판매가(price/옵션가) 필드 자체를 미전송(null)하고
// masked 플래그만 내린다. CSS 가리기가 아니라 서버사이드에서 실가를 전송조차 하지 않음.
// 회원 세션은 auth.routes.ts가 req.session.member = { uid, ... } 로 주입한다.
function isMemberLoggedIn(req: unknown): boolean {
    const uid = (req as { session?: { member?: { uid?: unknown } } } | undefined)?.session?.member
        ?.uid;
    return uid != null && String(uid).length > 0;
}

const DB_TIME_OFFSET_MS = 9 * 60 * 60 * 1000;

function getDbNow(): Date {
    return new Date(Date.now() + DB_TIME_OFFSET_MS);
}

function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

function formatDbDateTime(value?: Date | null): string | null {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;

    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(
        d.getUTCHours()
    )}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

function calcTimeLeftFromEnd(end?: Date | null): string | undefined {
    if (!end) return undefined;
    const now = getDbNow();
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return "마감";

    // 날짜 단위 D-day (시간 무관, 같은 날이면 시간으로 fallback)
    const nowDateMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const endDateMs = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    const days = Math.round((endDateMs - nowDateMs) / (24 * 60 * 60 * 1000));

    if (days >= 1) return `D-${days}`;

    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    if (hrs >= 1) return `${hrs}시간 뒤 마감`;
    return `${mins}분 뒤 마감`;
}

function goodsImageUrl(raw: string | null | undefined): string {
    const s = String(raw ?? "").trim();
    if (!s) return "";

    if (/^https?:\/\//i.test(s)) return s;
    if (/^\/\//.test(s)) return `https:${s}`;

    const base = (process.env.GOODS_IMAGE_BASE_URL || "https://zpzp.kr").replace(/\/+$/, "");
    const path = s.replace(/^\/+/, "");

    if (/^image\//i.test(path)) {
        return `${base}/${path}`;
    }

    return `${base}/image/goods/img${path}`;
}

function goodsOtherImageUrl(uid: bigint | number | string, raw: string | null | undefined): string {
    const s = String(raw ?? "").trim();
    if (!s) return "";

    if (/^https?:\/\//i.test(s)) return s;
    if (/^\/\//.test(s)) return `https:${s}`;

    const base = (process.env.GOODS_IMAGE_BASE_URL || "https://zpzp.kr").replace(/\/+$/, "");
    const n = Number(uid);
    const imgBlock = Number.isFinite(n) ? Math.max(1, Math.floor(n / 10000)) : 1;
    const path = s.replace(/^\/+/, "");

    if (/^image\//i.test(path)) {
        return `${base}/${path}`;
    }

    return `${base}/image/goods/upload/${imgBlock}/${uid}/${path}`;
}

function normalizeImages(row: {
    uid?: bigint | number | string;
    other_image?: string | null;
    image1?: string | null;
}): ImageItem[] {
    const out: ImageItem[] = [];

    const main = goodsImageUrl(row.image1);
    if (main) {
        out.push({ key: main, label: "대표 이미지" });
    }

    const other = String(row?.other_image ?? "").trim();
    if (other) {
        other
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
            .forEach((name, idx) => {
                out.push({
                    key: goodsOtherImageUrl(row.uid ?? "", name),
                    label: `추가 이미지 ${idx + 1}`,
                });
            });
    }

    const uniq = Array.from(new Map(out.map((x) => [x.key, x])).values());
    return uniq.length ? uniq : [{ key: "", label: "이미지 없음" }];
}

function formatStockNote(input: {
    soldout: boolean;
    qtyType?: number;
    qty?: number | null;
}) {
    if (input.soldout) return "🔥 한정수량 마감! 🔥";

    const qtyType = Number(input.qtyType ?? 1);
    const qty = input.qty == null ? null : Number(input.qty);

    if (qtyType === 1) return "수량 제한 없음";
    if (qty == null || !Number.isFinite(qty)) return "재고 확인 필요";

    if (qty <= 10) return "⏰ 한정수량 마감 임박!";
    return `🔥 ${qty}개 남았습니다!`;
}

function parseOptionsFromOptionInfo(row: {
    option_use?: number;
    option_soldout?: number;
    option_info?: string;
    price?: number | null;
    qty_type?: number;
    qty?: number | null;
}): PublicOptionItem[] {
    const optionUse = Number(row?.option_use ?? 0);
    if (!optionUse) return [];

    const optionSoldout = Number(row?.option_soldout ?? 0);
    const allSoldout = optionSoldout === 2;

    const text = String(row?.option_info ?? "").trim();
    if (!text) return [];

    const groups = text
        .split("|*|")
        .map((g) => g.trim())
        .filter(Boolean);

    const out: PublicOptionItem[] = [];

    const basePrice = Number(row?.price ?? 0) || 0;
    const goodsQtyType = Number(row?.qty_type ?? 1);
    const goodsQty = Number(row?.qty ?? 0) || 0;

    let seq = 0;

    for (const group of groups) {
        const parts = group.split("|");
        if (parts.length < 2) continue;

        const itemsRaw = String(parts.slice(1).join("|") ?? "").trim();
        const items = itemsRaw.split(",").map((x) => x.trim()).filter(Boolean);

        for (const item of items) {
            const seg = item.split("^").map((x) => x.trim());
            const valueName = String(seg[0] ?? "").trim();
            if (!valueName) continue;

            const addPrice = seg.length >= 2 ? Number(seg[1] ?? 0) || 0 : 0;
            const stockQty = seg.length >= 3 ? Number(seg[2] ?? 0) : null;

            let soldout = false;

            if (allSoldout) {
                soldout = true;
            } else if (stockQty !== null && Number.isFinite(stockQty)) {
                soldout = stockQty <= 0;
            } else if (goodsQtyType === 0) {
                soldout = goodsQty <= 0;
            }

            out.push({
                id: `opt_${seq}`,
                name: valueName,
                price: basePrice + addPrice,
                addPrice,
                qty: stockQty !== null && Number.isFinite(stockQty) ? stockQty : undefined,
                qtyType: stockQty !== null && Number.isFinite(stockQty) ? 0 : goodsQtyType,
                soldout,
                stockNote: formatStockNote({
                    soldout,
                    qtyType: stockQty !== null && Number.isFinite(stockQty) ? 0 : goodsQtyType,
                    qty: stockQty !== null && Number.isFinite(stockQty) ? stockQty : goodsQty,
                }),
                rawOptionId: seq + 1,
            });

            seq += 1;
        }
    }

    return out;
}

function buildOptionsFromTable(
    rows: Array<{
        uid: number;
        value: string;
        price: number;
        qty_type: number;
        qty: number;
        used: number;
        code: string;
        sequence: number;
    }>,
    goods: {
        option_use?: number;
        option_soldout?: number;
        price?: number | null;
    }
): PublicOptionItem[] {
    const optionUse = Number(goods?.option_use ?? 0);
    if (!optionUse) return [];

    const allSoldout = Number(goods?.option_soldout ?? 0) === 2;
    const basePrice = Number(goods?.price ?? 0) || 0;

    return rows
        .filter((r) => Number(r.used ?? 0) === 1)
        .sort((a, b) => {
            const seqDiff = Number(a.sequence ?? 0) - Number(b.sequence ?? 0);
            if (seqDiff !== 0) return seqDiff;
            return Number(a.uid ?? 0) - Number(b.uid ?? 0);
        })
        .map((r) => {
            const qtyType = Number(r.qty_type ?? 1);
            const qty = Number(r.qty ?? 0);
            const soldout = allSoldout || (qtyType === 0 && qty <= 0);
            const addPrice = Number(r.price ?? 0) || 0;

            return {
                id: `opt_${r.uid}`,
                name: String(r.value ?? "").trim(),
                price: basePrice + addPrice,
                addPrice,
                qty,
                qtyType,
                soldout,
                stockNote: formatStockNote({ soldout, qtyType, qty }),
                rawOptionId: Number(r.uid),
                code: String(r.code ?? "").trim() || undefined,
            };
        })
        .filter((item) => !!item.name);
}

function formatKoreanShortDate(value?: Date | null): string {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";

    const utc = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds())
    );

    const mm = pad2(utc.getUTCMonth() + 1);
    const dd = pad2(utc.getUTCDate());
    const dayKor = ["일", "월", "화", "수", "목", "금", "토"][utc.getUTCDay()] ?? "";

    return `${mm}월 ${dd}일 (${dayKor})`;
}

function formatMMDDDay(value?: Date | null): string {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";

    const utc = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds())
    );

    const mm = pad2(utc.getUTCMonth() + 1);
    const dd = pad2(utc.getUTCDate());
    const dayKor = ["일", "월", "화", "수", "목", "금", "토"][utc.getUTCDay()] ?? "";

    return `${mm}.${dd}(${dayKor})`;
}

function formatKoreanSaleEndDate(value?: Date | null): string | undefined {
    const text = formatMMDDDay(value);
    if (!text) return undefined;
    return `공구마감일: ${text}`;
}

function buildPickupBadgeText(input: {
    pickupOnly?: boolean | null;
    pickupStartAt?: Date | null;
    pickupEndAt?: Date | null;
}) {
    const dateText = formatMMDDDay(input.pickupStartAt) || formatMMDDDay(input.pickupEndAt);
    if (dateText) return `픽업일: ${dateText}~`;
    if (input.pickupOnly) return "픽업일: 바로 픽업 가능";
    return undefined;
}

function buildPublicGoodsWhere(tenantId: bigint): Prisma.mallRN_goodsWhereInput {
    const now = getDbNow();

    return {
        tenant_id: { in: [tenantId, HQ_TENANT_ID] },
        sale_use: 1,
        display_use: 1,
        auth_ck: "Y",
        deleted_at: null,
        status: "active",
        cate_hide: 0,
        vendor_hide: 0,
        AND: [
            {
                OR: [
                    { sale_start_at: null },
                    { sale_start_at: { lte: now } },
                ],
            },
            {
                OR: [
                    { sale_end_at: null },
                    { sale_end_at: { gte: now } },
                    {
                        sale_end_at: {
                            equals: null,
                        },
                    },
                ],
            },
        ],
    };
}

function buildProductOrderBy(
    segment?: "today" | "pickup" | "ongoing"
): Prisma.mallRN_goodsOrderByWithRelationInput[] {
    if (segment === "today") {
        return [{ sort_order: "desc" }, { moddate: "desc" }, { uid: "desc" }];
    }

    if (segment === "pickup") {
        return [{ sort_order: "desc" }, { sale_end_at: "asc" }, { moddate: "desc" }, { uid: "desc" }];
    }

    if (segment === "ongoing") {
        return [{ sale_end_at: "asc" }, { sort_order: "desc" }, { moddate: "desc" }, { uid: "desc" }];
    }

    return [{ sort_order: "desc" }, { moddate: "desc" }, { uid: "desc" }];
}

function applySegmentFilter(
    where: Prisma.mallRN_goodsWhereInput,
    segment?: "today" | "pickup" | "ongoing"
) {
    if (!segment) return;

    if (segment === "today") {
        where.cate = CATE_DAILY_DEAL;
        return;
    }

    if (segment === "pickup") {
        where.cate = CATE_PICKUP_READY;
        return;
    }

    if (segment === "ongoing") {
        where.sale_end_at = { not: null, gte: new Date() };
    }
}

function applyCategoryFilter(
    where: Prisma.mallRN_goodsWhereInput,
    category?: string,
    cate?: bigint | null
) {
    if (cate !== null && cate !== undefined) {
        where.cate = cate;
        return;
    }

    const normalized = String(category ?? "").trim().toLowerCase();
    if (!normalized || normalized === "all") return;

    if (normalized === "daily-deal" || normalized === "today") {
        where.cate = CATE_DAILY_DEAL;
        return;
    }

    if (normalized === "pickup-ready" || normalized === "pickup") {
        where.cate = CATE_PICKUP_READY;
        return;
    }

    if (/^\d+$/.test(normalized)) {
        where.cate = BigInt(normalized);
    }
}

function categoryLabelFromCate(cate?: bigint | null) {
    const value = cate == null ? "" : String(cate);
    if (value === "100000") return "오늘의 공구";
    if (value === "100001") return "바로 픽업 가능";
    return undefined;
}

function isPickupReadyCate(cate?: bigint | null) {
    return String(cate ?? "") === "100001";
}

export async function publicProductRoutes(app: FastifyInstance) {
    app.addHook("preHandler", requireTenant());

    async function getLinkerSelection(req: any) {
        const slug = String(req.cookies?.zpzp_ref ?? "").trim().toLowerCase();
        if (!slug) return null;
        const linker = await app.prisma.zpzp_linker.findFirst({
            where: { shop_slug: slug, status: "active" },
            select: { uid: true, member_uid: true },
        });
        if (!linker) return null;
        const rows = await app.prisma.mallRN_linker_products.findMany({
            where: {
                linker_uid: linker.uid,
                selection_status: "selected",
                display_status: "visible",
            },
            orderBy: [{ display_order: "asc" }, { selected_at: "desc" }],
            select: { product_uid: true, display_order: true },
        });
        if (rows.length === 0) return { linkerUid: linker.uid, rows, ids: [] as number[] };

        const sellingProducts = await app.prisma.mallRN_goods.findMany({
            where: {
                uid: { in: rows.map((row) => row.product_uid) },
                status: "published",
                sale_use: 1,
                deleted_at: null,
                AND: [{ OR: [{ sale_end_at: null }, { sale_end_at: { gte: new Date() } }] }],
            },
            select: { uid: true },
        });
        const sellingIds = new Set(sellingProducts.map((product) => product.uid));
        const visibleSelling = rows.filter((row) => sellingIds.has(row.product_uid));
        return {
            linkerUid: linker.uid,
            rows: visibleSelling,
            ids: visibleSelling.map((row) => row.product_uid),
        };
    }

    app.get("/v1/public/products", async (req) => {
        const tenantSlug: string | undefined = (req as any).tenantSlug;
        const tenantId = (req as any).tenantId as bigint;

        const q = z
            .object({
                q: z.string().optional(),
                take: z.coerce.number().min(1).max(200).default(20),
                type: z.enum(["today", "pickup", "ongoing"]).optional(),
                tab: z.enum(["today", "pickup", "ongoing"]).optional(),
                category: z.string().optional(),
                cate: z.coerce.number().int().nonnegative().optional(),
            })
            .parse(req.query);

        const segment = q.type ?? q.tab;
        const where: Prisma.mallRN_goodsWhereInput = buildPublicGoodsWhere(tenantId);
        const linkerSelection = await getLinkerSelection(req);
        if (linkerSelection) {
            const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
            where.AND = [
                ...existingAnd,
                {
                    OR: [
                        { tenant_id: tenantId },
                        { tenant_id: HQ_TENANT_ID, uid: { in: linkerSelection.ids } },
                    ],
                },
            ];
        }

        if (q.q?.trim()) {
            const keyword = q.q.trim();
            where.OR = [
                { name: { contains: keyword } },
                { explains: { contains: keyword } },
                { detail: { contains: keyword } },
            ];
        }

        applySegmentFilter(where, segment);
        applyCategoryFilter(where, q.category, q.cate != null ? BigInt(q.cate) : null);

        const queriedRows = await app.prisma.mallRN_goods.findMany({
            where,
            orderBy: buildProductOrderBy(segment),
            // 링커 선택 상품을 진열 순서대로 재정렬할 수 있도록 선택 건수만큼 후보를 확보한다.
            take: linkerSelection ? Math.min(1000, q.take + linkerSelection.ids.length) : q.take,
            select: {
                uid: true,
                tenant_id: true,
                cate: true,
                name: true,
                price: true,
                image1: true,
                pickup_only: true,
                option_use: true,
                icon: true,
                sale_start_at: true,
                sale_end_at: true,
                pickup_start_at: true,
                pickup_end_at: true,
                pickup_note: true,
            },
        });

        const masked = !isMemberLoggedIn(req); // 비회원이면 실판매가 미전송
        const rows = linkerSelection
            ? (() => {
                const displayOrder = new Map(
                    linkerSelection.rows.map((row, index) => [row.product_uid, index])
                );
                return [...queriedRows]
                    .sort((a, b) => {
                        const aOrder = displayOrder.get(a.uid);
                        const bOrder = displayOrder.get(b.uid);
                        if (aOrder != null && bOrder != null) return aOrder - bOrder;
                        if (aOrder != null) return -1;
                        if (bOrder != null) return 1;
                        return 0;
                    })
                    .slice(0, q.take);
            })()
            : queriedRows;

        const items = rows.map((r) => {
            const thumb = goodsImageUrl(r.image1);
            const hideScheduleMeta = isPickupReadyCate(r.cate);

            const saleEndDateText = hideScheduleMeta
                ? undefined
                : formatKoreanSaleEndDate(r.sale_end_at ?? null);

            const pickupBadgeText = hideScheduleMeta
                ? undefined
                : buildPickupBadgeText({
                    pickupOnly: !!r.pickup_only,
                    pickupStartAt: r.pickup_start_at ?? null,
                    pickupEndAt: r.pickup_end_at ?? null,
                });

            return {
                id: toId(r.uid),
                title: String(r.name ?? ""),
                price: masked ? null : toNumber(r.price, 0),
                masked,
                categoryLabel: categoryLabelFromCate(r.cate),
                metaLeft: saleEndDateText,
                metaRight: pickupBadgeText,
                thumbnailUrl: thumb || undefined,
                sourceTenantId: r.tenant_id != null ? toId(r.tenant_id) : null,
                cate: r.cate != null ? toId(r.cate) : null,
                icon: String(r.icon ?? ""),
                optionUse: Number(r.option_use ?? 0),
                saleStartAt: formatDbDateTime(r.sale_start_at),
                saleEndAt: formatDbDateTime(r.sale_end_at),
                pickupStartAt: hideScheduleMeta ? null : formatDbDateTime(r.pickup_start_at),
                pickupEndAt: hideScheduleMeta ? null : formatDbDateTime(r.pickup_end_at),
                pickupNote: hideScheduleMeta ? null : (r.pickup_note ? String(r.pickup_note) : null),
            };
        });

        return {
            ok: true,
            tenant: tenantSlug,
            type: segment ?? null,
            category: q.category ?? null,
            cate: q.cate ?? null,
            items,
        };
    });

    app.get("/v1/public/products/:id", async (req, reply) => {
        const tenantSlug: string | undefined = (req as any).tenantSlug;
        const tenantId = (req as any).tenantId as bigint;

        const params = z.object({ id: z.string() }).parse(req.params);
        const uid = Number(params.id);
        const linkerSelection = await getLinkerSelection(req);
        if (linkerSelection) {
            const candidate = await app.prisma.mallRN_goods.findUnique({
                where: { uid },
                select: { tenant_id: true },
            });
            if (candidate?.tenant_id === HQ_TENANT_ID && !linkerSelection.ids.includes(uid)) {
                return reply.code(404).send({ ok: false });
            }
        }

        const row = await app.prisma.mallRN_goods.findFirst({
            where: {
                uid,
                ...buildPublicGoodsWhere(tenantId),
            },
            select: {
                uid: true,
                tenant_id: true,
                cate: true,
                name: true,
                price: true,
                explains: true,
                detail: true,
                image1: true,
                other_image: true,
                option_use: true,
                option_info: true,
                option_soldout: true,
                pickup_only: true,
                sale_start_at: true,
                sale_end_at: true,
                pickup_start_at: true,
                pickup_end_at: true,
                pickup_note: true,
                qty_type: true,
                qty: true,
            },
        });

        if (!row) {
            reply.code(404).send({ ok: false });
            return;
        }

        const optionRows =
            Number(row.option_use ?? 0) === 1
                ? await app.prisma.mallRN_goods_option.findMany({
                    where: {
                        guid: uid,
                        used: 1,
                    },
                    select: {
                        uid: true,
                        value: true,
                        price: true,
                        qty_type: true,
                        qty: true,
                        used: true,
                        code: true,
                        sequence: true,
                    },
                    orderBy: [{ sequence: "asc" }, { uid: "asc" }],
                })
                : [];

        const images = normalizeImages(row);
        const options =
            optionRows.length > 0
                ? buildOptionsFromTable(optionRows, row)
                : parseOptionsFromOptionInfo(row);

        const desc =
            String(row.explains ?? "").trim() ||
            String(row.detail ?? "").trim() ||
            null;

        const hasPickupPeriod = !!row.pickup_start_at || !!row.pickup_end_at;
        const hideScheduleMeta = isPickupReadyCate(row.cate);

        const masked = !isMemberLoggedIn(req); // 비회원이면 실판매가 미전송
        // 비회원엔 옵션가(기본가+추가금)와 추가금 자체를 모두 미전송 — 역산 방지
        const maskedOptions = masked
            ? options.map((o) => ({ ...o, price: null, addPrice: undefined }))
            : options;

        const product = {
            id: toId(row.uid),
            title: String(row.name ?? ""),
            price: masked ? null : toNumber(row.price, 0),
            masked,
            description: desc,
            categoryLabel: categoryLabelFromCate(row.cate),
            meta: {
                timeLeft: hideScheduleMeta ? undefined : calcTimeLeftFromEnd(row.sale_end_at ?? null),
                pickup: hideScheduleMeta
                    ? undefined
                    : hasPickupPeriod
                        ? undefined
                        : row.pickup_only
                            ? "바로 픽업 가능 / 주문 후 매장에서 바로 수령"
                            : undefined,
                pickupStartAt: hideScheduleMeta ? null : formatDbDateTime(row.pickup_start_at),
                pickupEndAt: hideScheduleMeta ? null : formatDbDateTime(row.pickup_end_at),
                pickupNote: hideScheduleMeta ? null : (row.pickup_note ? String(row.pickup_note) : null),
            },
            images,
            options: maskedOptions,
            sourceTenantId: row.tenant_id != null ? toId(row.tenant_id) : null,
            saleStartAt: formatDbDateTime(row.sale_start_at),
            saleEndAt: formatDbDateTime(row.sale_end_at),
            cate: row.cate != null ? toId(row.cate) : null,
        };

        return {
            ok: true,
            tenant: tenantSlug,
            product,
        };
    });
}
