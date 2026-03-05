// apps/api/src/modules/public/products.routes.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireTenant } from "../../common/guard.js";

type ImageItem = { key: string; label?: string };

function toId(v: bigint | number | string): string {
    if (typeof v === "bigint") return v.toString();
    return String(v);
}

function toNumber(v: any, fallback = 0): number {
    if (v == null) return fallback;
    if (typeof v === "number") return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function calcTimeLeftFromEnd(end?: Date | null): string | undefined {
    if (!end) return undefined;
    const diff = end.getTime() - Date.now();
    if (diff <= 0) return "마감";
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days >= 1) return `D-${days}`;
    if (hrs >= 1) return `${hrs}시간 남음`;
    return `${mins}분 남음`;
}

function goodsImageUrl(raw: string | null | undefined): string {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;

    const base = (process.env.GOODS_IMAGE_BASE_URL ?? "").trim();
    if (!base) return s; // base 없으면 일단 그대로
    return base.endsWith("/") ? `${base}${s}` : `${base}/${s}`;
}

/**
 * ✅ images_json 없음 (schema 기준)
 * ✅ other_image(콤마) + 대표(image1/image2)로 구성
 */
function normalizeImages(row: {
    other_image?: string;
    image1?: string;
    image2?: string;
}): ImageItem[] {
    const out: ImageItem[] = [];

    const pushUrl = (u: unknown) => {
        if (typeof u !== "string") return;
        const s = u.trim();
        if (!s) return;
        out.push({ key: goodsImageUrl(s) });
    };

    // 1) other_image (콤마 문자열)
    const other = String(row?.other_image ?? "").trim();
    if (other) {
        other
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
            .forEach((x) => pushUrl(x));
    }

    // 2) 대표/목록 이미지
    const img1 = String(row?.image1 ?? "").trim();
    const img2 = String(row?.image2 ?? "").trim();
    if (img1) pushUrl(img1);
    if (img2) pushUrl(img2);

    // 중복 제거
    const uniq = Array.from(new Map(out.map((x) => [x.key, x])).values());
    return uniq.length ? uniq : [{ key: "", label: "이미지 없음" }];
}

/**
 * ✅ option_info (옵션명|옵션항목|*|옵션명|옵션항목...)
 * - 옵션항목은 사이트마다 "항목^추가금액^재고" 같은 케이스가 많아서 ^로 느슨히 파싱
 */
function parseOptions(row: {
    option_use?: number;
    option_soldout?: number;
    option_info?: string;
}): Array<{
    id: string;
    name: string;
    price: number | null;
    soldout?: boolean;
    stockNote?: string;
}> {
    const optionUse = Number(row?.option_use ?? 0);
    if (!optionUse) return [];

    const optionSoldout = Number(row?.option_soldout ?? 0); // 2면 전체품절
    const allSoldout = optionSoldout === 2;

    const text = String(row?.option_info ?? "").trim();
    if (!text) return [];

    const groups = text
        .split("|*|")
        .map((g: string) => g.trim())
        .filter(Boolean);

    const out: any[] = [];
    let seq = 0;

    for (const g of groups) {
        const parts = g.split("|");
        if (parts.length < 2) continue;

        const optName = String(parts[0] ?? "").trim();
        const itemsRaw = String(parts.slice(1).join("|") ?? "").trim();

        const items = itemsRaw.split(",").map((x) => x.trim()).filter(Boolean);
        for (const it of items) {
            const seg = it.split("^").map((x) => x.trim());
            const itemName = String(seg[0] ?? "").trim();
            if (!itemName) continue;

            const addPrice = seg.length >= 2 ? toNumber(seg[1], 0) : 0;
            const stock = seg.length >= 3 ? toNumber(seg[2], NaN) : NaN;

            const soldout = allSoldout || (Number.isFinite(stock) && stock <= 0);
            const name = optName ? `${optName} / ${itemName}` : itemName;

            out.push({
                id: `opt_${seq++}`,
                name,
                price: addPrice, // “추가금액”
                soldout,
                stockNote: soldout ? "품절" : Number.isFinite(stock) ? `재고 ${stock}` : undefined,
            });
        }
    }

    return out;
}

type ProductsQuery = { q?: string; cursor?: string; take: number };

type ProductsListResponse = {
    ok: true;
    tenant?: string;
    items: Array<{
        id: string;
        title: string;
        price: number;
        metaLeft?: string;
        metaRight?: string;
        thumbnailUrl?: string;
    }>;
};

type ProductDetailResponse = {
    ok: true;
    tenant?: string;
    product: {
        id: string;
        title: string;
        price: number;
        description?: string | null;
        meta?: { timeLeft?: string; pickup?: string };
        images: { key: string; label?: string }[];
        options: Array<{
            id: string;
            name: string;
            price: number | null;
            soldout?: boolean;
            stockNote?: string;
        }>;
    };
};

export async function publicProductRoutes(app: FastifyInstance) {
    app.addHook("preHandler", requireTenant());

    // GET /v1/public/products
    app.get<{ Querystring: ProductsQuery }>("/v1/public/products", async (req) => {
        const tenantSlug: string | undefined = (req as any).tenantSlug ?? undefined;
        const tenantId = (req as any).tenantId as bigint;

        const q = z
            .object({
                q: z.string().optional(),
                cursor: z.string().optional(),
                take: z.coerce.number().min(1).max(50).default(20),
            })
            .parse(req.query);

        const where: Prisma.mallRN_goodsWhereInput = {
            tenant_id: tenantId,
            sale_use: 1,
            display_use: 1,
            auth_ck: "Y",
            deleted_at: null,
            status: "active",
            ...(q.q
                ? {
                    OR: [
                        { name: { contains: q.q } },
                        { explains: { contains: q.q } },
                        { detail: { contains: q.q } },
                    ],
                }
                : {}),
        };

        const rows = await app.prisma.mallRN_goods.findMany({
            where,
            orderBy: [{ sort_order: "desc" }, { moddate: "desc" }, { uid: "desc" }],
            take: q.take,
            select: {
                uid: true,
                name: true,
                price: true,
                image2: true,
                image1: true,
                pickup_only: true,
                sale_end_at: true,
            },
        });

        const items: ProductsListResponse["items"] = rows.map((r) => {
            const thumb = goodsImageUrl(r.image2 || r.image1);
            const timeLeft = calcTimeLeftFromEnd(r.sale_end_at ?? null);

            return {
                id: toId(r.uid),
                title: String(r.name ?? ""),
                price: toNumber(r.price, 0),
                metaLeft: timeLeft,
                metaRight: r.pickup_only ? "픽업" : undefined,
                thumbnailUrl: thumb || undefined,
            };
        });

        return { ok: true, tenant: tenantSlug, items } satisfies ProductsListResponse;
    });

    // GET /v1/public/products/:id
    app.get<{ Params: { id: string } }>("/v1/public/products/:id", async (req, reply) => {
        const tenantSlug: string | undefined = (req as any).tenantSlug ?? undefined;
        const tenantId = (req as any).tenantId as bigint;

        const params = z.object({ id: z.string() }).parse(req.params);
        const uid = Number(params.id);

        if (!Number.isFinite(uid) || uid <= 0) {
            reply.code(400).send({ ok: false, error: "INVALID_ID" });
            return;
        }

        const row = await app.prisma.mallRN_goods.findFirst({
            where: {
                uid,
                tenant_id: tenantId,
                sale_use: 1,
                display_use: 1,
                auth_ck: "Y",
                deleted_at: null,
                status: "active",
            },
            select: {
                uid: true,
                name: true,
                price: true,
                explains: true,
                detail: true,
                image1: true,
                image2: true,
                other_image: true,
                detail_image: true,
                option_use: true,
                option_info: true,
                option_soldout: true,
                pickup_only: true,
                sale_end_at: true,
            },
        });

        if (!row) {
            reply.code(404).send({ ok: false, error: "NOT_FOUND" });
            return;
        }

        const images = normalizeImages(row);
        const desc = String(row.explains ?? "").trim() || String(row.detail ?? "").trim() || null;

        const parsedOptions = parseOptions(row);
        const options =
            parsedOptions.length > 0
                ? parsedOptions.map((o) => ({
                    ...o,
                    price: o.price == null ? null : toNumber(row.price, 0) + toNumber(o.price, 0),
                }))
                : [
                    {
                        id: "base",
                        name: "기본 구성",
                        price: null,
                        soldout: false,
                        stockNote: "바로 주문 가능",
                    },
                ];

        const timeLeft = calcTimeLeftFromEnd(row.sale_end_at ?? null);

        const product: ProductDetailResponse["product"] = {
            id: toId(row.uid),
            title: String(row.name ?? ""),
            price: toNumber(row.price, 0),
            description: desc,
            meta: {
                timeLeft,
                pickup: row.pickup_only ? "픽업 상품" : undefined,
            },
            images: images.map((x, idx) => ({
                key: x.key,
                label: idx === 0 ? "대표 이미지" : undefined,
            })),
            options,
        };

        return { ok: true, tenant: tenantSlug, product } satisfies ProductDetailResponse;
    });
}