// apps/api/src/modules/public/products.routes.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireTenant } from "../../common/guard.js";

/**
 * ✅ JSON-safe helpers (BigInt/Decimal 등)
 */
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
 * images_json LONGTEXT 저장 형태를 느슨하게 허용
 * - JSON 문자열: ["url1","url2"]
 * - JSON 문자열: { "urls":[...]} / { "images":[...]} / { "items":[...]}
 * - 그냥 문자열(단일 URL)도 허용
 */
function normalizeImagesFromLongText(
    imagesJsonText: string | null | undefined,
    thumbnailUrl?: string | null,
): ImageItem[] {
    const out: ImageItem[] = [];

    const pushUrl = (u: unknown) => {
        if (typeof u !== "string") return;
        const s = u.trim();
        if (!s) return;
        out.push({ key: s });
    };

    // 1) images_json 파싱
    if (typeof imagesJsonText === "string" && imagesJsonText.trim()) {
        const raw = imagesJsonText.trim();

        // 단일 url일 수도 있음
        if (/^https?:\/\//i.test(raw)) {
            pushUrl(raw);
        } else {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    for (const u of parsed) pushUrl(u);
                } else if (parsed && typeof parsed === "object") {
                    const obj = parsed as Record<string, unknown>;
                    const urls = obj.urls ?? obj.images ?? obj.items;
                    if (Array.isArray(urls)) {
                        for (const u of urls) pushUrl(u);
                    }
                }
            } catch {
                // JSON 아닌 텍스트면 무시 (또는 추후 파서 확장)
            }
        }
    }

    // 2) thumbnail_url도 포함
    if (typeof thumbnailUrl === "string" && thumbnailUrl.trim()) {
        pushUrl(thumbnailUrl);
    }

    // 중복 제거
    const uniq = Array.from(new Map(out.map((x) => [x.key, x])).values());
    return uniq.length ? uniq : [{ key: "", label: "이미지 없음" }];
}

type ProductsQuery = {
    q?: string;
    cursor?: string;
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

        // ✅ 추가: DB description 표시용
        description?: string | null;

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
    // GET /:tenant/v1/public/products
    app.get<{ Querystring: ProductsQuery }>("/v1/public/products", async (req, reply) => {
        if (!requireTenant(req, reply)) return;

        // ✅ tenantSlug는 string | null | undefined 로 잡힐 수 있어 null -> undefined로 정규화
        const tenantSlug: string | undefined = req.tenantSlug ?? undefined;

        const q = z
            .object({
                q: z.string().optional(),
                cursor: z.string().optional(),
                take: z.coerce.number().min(1).max(50).default(20),
            })
            .parse(req.query);

        const where: Prisma.ProductWhereInput = {
            tenantId: req.tenantId!,
            status: "active",
            ...(q.q
                ? {
                    OR: [{ title: { contains: q.q } }, { description: { contains: q.q } }],
                }
                : {}),
        };

        const products = await app.prisma.product.findMany({
            where,
            orderBy: [{ sortOrder: "desc" }, { updatedAt: "desc" }],
            take: q.take,
            select: {
                id: true,
                title: true,
                basePrice: true,
                pickupOnly: true,
                saleEndAt: true,
                thumbnailUrl: true,
            },
        });

        const items: ProductsListResponse["items"] = products.map((p) => ({
            id: toId(p.id),
            title: p.title,
            price: toNumber(p.basePrice, 0),
            metaLeft: calcTimeLeft(p.saleEndAt),
            metaRight: p.pickupOnly ? "픽업" : undefined,
            thumbnailUrl: p.thumbnailUrl ?? undefined,
        }));

        return { ok: true, tenant: tenantSlug, items } satisfies ProductsListResponse;
    });

    // GET /:tenant/v1/public/products/:id
    app.get<{ Params: { id: string } }>("/v1/public/products/:id", async (req, reply) => {
        if (!requireTenant(req, reply)) return;

        // ✅ tenantSlug null 방지
        const tenantSlug: string | undefined = req.tenantSlug ?? undefined;

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

        // ✅ images_json(LONGTEXT) + thumbnail_url 기반으로 구성
        const images = normalizeImagesFromLongText(p.imagesJson as any, p.thumbnailUrl);

        const options: ProductDetailResponse["product"]["options"] = (p.options ?? []).map((o) => {
            const stock = o.stockQty ?? null;
            const soldout = !o.isActive || stock === 0;

            return {
                id: toId(o.id),
                name: o.name,
                price: o.price == null ? null : toNumber(o.price, 0),
                soldout,
                stockNote: soldout ? "품절" : stock != null ? `재고 ${stock}` : undefined,
            };
        });

        const product: ProductDetailResponse["product"] = {
            id: toId(p.id),
            title: p.title,
            price: toNumber(p.basePrice, 0),

            // ✅ 핵심: 상세설명 내려주기
            description: p.description ?? null,

            badges: undefined,
            meta: {
                timeLeft: calcTimeLeft(p.saleEndAt),
                pickup: p.pickupOnly ? "픽업 상품" : undefined,
            },
            images: images.map((x, idx) => ({
                key: x.key,
                label: idx === 0 ? "대표 이미지" : undefined,
            })),
            options: options.length
                ? options
                : [{ id: "base", name: "기본 구성", price: null, soldout: false, stockNote: "바로 주문 가능" }],
            notices: undefined,
        };

        return { ok: true, tenant: tenantSlug, product } satisfies ProductDetailResponse;
    });
}