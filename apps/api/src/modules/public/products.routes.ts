import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireTenant } from "../../common/guard.js";

/**
 * ✅ JSON-safe helpers (BigInt/Decimal 등)
 */
function toId(v: bigint | number | string): string {
    if (typeof v === "bigint") return v.toString();
    return String(v);
}

function toNumber(v: Prisma.Decimal | number | string | null | undefined, fallback = 0): number {
    if (v == null) return fallback;
    if (typeof v === "number") return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function calcTimeLeft(end?: Date | null): string | undefined {
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

type ImageItem = { key: string; label?: string };

/**
 * imagesJson이 Prisma.JsonValue이므로, 타입 안전하게 파싱
 * - ["url1","url2"]
 * - { urls:[...]} / { images:[...]} / { items:[...]} 같은 느슨한 형태를 허용
 */
function normalizeImages(
    imagesJson: Prisma.JsonValue | null,
    thumbnailUrl?: string | null,
): ImageItem[] {
    const out: ImageItem[] = [];

    const pushUrl = (u: unknown) => {
        if (typeof u !== "string") return;
        const s = u.trim();
        if (!s) return;
        out.push({ key: s });
    };

    if (Array.isArray(imagesJson)) {
        for (const u of imagesJson) pushUrl(u);
    } else if (imagesJson && typeof imagesJson === "object") {
        const obj = imagesJson as Record<string, unknown>;
        const urls = obj.urls ?? obj.images ?? obj.items;
        if (Array.isArray(urls)) {
            for (const u of urls) pushUrl(u);
        }
    }

    if (typeof thumbnailUrl === "string" && thumbnailUrl.trim()) {
        pushUrl(thumbnailUrl);
    }

    // 중복 제거
    const uniq = Array.from(new Map(out.map((x) => [x.key, x])).values());
    return uniq;
}

type ProductsQuery = {
    q?: string;
    cursor?: string; // (MVP에서는 미사용)
    take: number;
};

type ProductsListResponse = {
    ok: true;
    tenant?: string;
    items: Array<{
        id: string;
        title: string;
        price: number;
        badgeLeft?: string;
        badgeRight?: string;
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
        badges?: { left?: string; right?: string };
        meta?: { timeLeft?: string; pickup?: string };
        images: { key: string; label?: string }[];
        options: Array<{
            id: string;
            name: string;
            price: number | null;
            soldout?: boolean;
            stockNote?: string;
        }>;
        notices?: Array<{ icon?: string; text: string }>;
    };
};

export async function publicProductRoutes(app: FastifyInstance) {
    // GET /:tenant/v1/public/page.tsx
    app.get<{ Querystring: ProductsQuery }>(
        "/v1/public/products",
        async (req, reply) => {
            if (!requireTenant(req, reply)) return;

            const q = z
                .object({
                    q: z.string().optional(),
                    cursor: z.string().optional(),
                    take: z.coerce.number().min(1).max(50).default(20),
                })
                .parse(req.query);

            // ✅ where 타입을 Prisma로 고정
            const where: Prisma.ProductWhereInput = {
                tenantId: req.tenantId!,
                status: "active",
                ...(q.q
                    ? {
                        OR: [
                            { title: { contains: q.q } },
                            { description: { contains: q.q } },
                        ],
                    }
                    : {}),
            };

            const products = await app.prisma.product.findMany({
                where,
                orderBy: { updatedAt: "desc" },
                take: q.take,
                include: {
                    options: {
                        where: { isActive: true },
                        orderBy: { sortOrder: "asc" },
                    },
                },
            });

            const items: ProductsListResponse["items"] = products.map((p) => ({
                id: toId(p.id),
                title: p.title,
                price: toNumber(p.basePrice, 0),
                badgeLeft: undefined,
                badgeRight: undefined,
                metaLeft: calcTimeLeft(p.saleEndAt),
                metaRight: p.pickupOnly ? "픽업" : undefined,
                thumbnailUrl: p.thumbnailUrl ?? undefined,
            }));

            const payload: ProductsListResponse = {
                ok: true,
                tenant: req.tenantSlug,
                items,
            };

            return payload;
        },
    );

    // GET /:tenant/v1/public/page.tsx/:id
    app.get<{ Params: { id: string } }>(
        "/v1/public/products/:id",
        async (req, reply) => {
            if (!requireTenant(req, reply)) return;

            const params = z.object({ id: z.string() }).parse(req.params);

            let idBig: bigint;
            try {
                idBig = BigInt(params.id);
            } catch {
                reply.code(400).send({ ok: false, error: "INVALID_ID" });
                return;
            }

            const p = await app.prisma.product.findFirst({
                where: { id: idBig, tenantId: req.tenantId!, status: "active" },
                include: {
                    options: { orderBy: { sortOrder: "asc" } },
                },
            });

            if (!p) {
                reply.code(404).send({ ok: false, error: "NOT_FOUND" });
                return;
            }

            const images = normalizeImages(p.imagesJson, p.thumbnailUrl);

            const options: ProductDetailResponse["product"]["options"] = p.options.map(
                (o) => {
                    const stock = o.stockQty ?? null;
                    const soldout = !o.isActive || stock === 0;

                    return {
                        id: toId(o.id),
                        name: o.name,
                        price: o.price == null ? null : toNumber(o.price, 0),
                        soldout,
                        stockNote: soldout
                            ? "품절"
                            : stock != null
                                ? `재고 ${stock}`
                                : undefined,
                    };
                },
            );

            const product: ProductDetailResponse["product"] = {
                id: toId(p.id),
                title: p.title,
                price: toNumber(p.basePrice, 0),
                badges: undefined,
                meta: {
                    timeLeft: calcTimeLeft(p.saleEndAt),
                    pickup: p.pickupOnly ? "픽업 상품" : undefined,
                },
                images: images.map((x, idx) => ({
                    key: x.key,
                    label: idx === 0 ? "대표 이미지" : undefined,
                })),
                options,
                notices: undefined,
            };

            const payload: ProductDetailResponse = {
                ok: true,
                tenant: req.tenantSlug,
                product,
            };

            return payload;
        },
    );
}