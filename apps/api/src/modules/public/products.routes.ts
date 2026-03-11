// apps/api/src/modules/public/products.routes.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireTenant } from "../../common/guard.js";

type ImageItem = { key: string; label?: string };

const HQ_TENANT_ID = BigInt(0);

function toId(v: bigint | number | string): string {
    if (typeof v === "bigint") return v.toString();
    return String(v);
}

function toNumber(v: any, fallback = 0): number {
    if (v == null) return fallback;
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
    if (/^\/\//.test(s)) return `https:${s}`;

    const base = (process.env.GOODS_IMAGE_BASE_URL || "https://discountallday.kr").replace(/\/+$/, "");
    const path = s.startsWith("/") ? s : `/${s}`;

    return `${base}${path}`;
}

function normalizeImages(row: {
    other_image?: string | null;
    image1?: string | null;
    image2?: string | null;
    image3?: string | null;
}): ImageItem[] {
    const out: ImageItem[] = [];

    const pushUrl = (u: unknown) => {
        if (typeof u !== "string") return;

        const s = u.trim();
        if (!s) return;

        out.push({ key: goodsImageUrl(s) });
    };

    const other = String(row?.other_image ?? "").trim();

    if (other) {
        other
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
            .forEach(pushUrl);
    }

    pushUrl(row.image1);
    pushUrl(row.image2);
    pushUrl(row.image3);

    const uniq = Array.from(new Map(out.map((x) => [x.key, x])).values());

    return uniq.length ? uniq : [{ key: "", label: "이미지 없음" }];
}

function parseOptions(row: {
    option_use?: number;
    option_soldout?: number;
    option_info?: string;
    price?: number | null;
}) {
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

    const out: Array<{
        id: string;
        name: string;
        price: number | null;
        soldout?: boolean;
        stockNote?: string;
    }> = [];

    let seq = 0;

    for (const group of groups) {
        const parts = group.split("|");
        if (parts.length < 2) continue;

        const groupName = String(parts[0] ?? "").trim();
        const itemsRaw = String(parts.slice(1).join("|") ?? "").trim();

        const items = itemsRaw.split(",").map((x) => x.trim()).filter(Boolean);

        for (const item of items) {
            const seg = item.split("^").map((x) => x.trim());
            const valueName = String(seg[0] ?? "").trim();
            if (!valueName) continue;

            const addPrice = seg.length >= 2 ? toNumber(seg[1], 0) : 0;
            const stockQty = seg.length >= 3 ? toNumber(seg[2], NaN) : NaN;
            const soldout = allSoldout || (Number.isFinite(stockQty) && stockQty <= 0);
            const basePrice = toNumber(row?.price, 0);

            out.push({
                id: `opt_${seq++}`,
                name: groupName ? `${valueName}` : valueName,
                price: basePrice + addPrice,
                soldout,
                stockNote: soldout ? "품절" : Number.isFinite(stockQty) ? `재고 ${stockQty}` : "주문 가능",
            });
        }
    }

    return out;
}

function buildPublicGoodsWhere(tenantId: bigint): Prisma.mallRN_goodsWhereInput {
    const now = new Date();

    return {
        tenant_id: {
            in: [tenantId, HQ_TENANT_ID],
        },
        sale_use: 1,
        display_use: 1,
        auth_ck: "Y",
        deleted_at: null,
        status: "active",
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
                ],
            },
        ],
    };
}

export async function publicProductRoutes(app: FastifyInstance) {
    app.addHook("preHandler", requireTenant());

    app.get("/v1/public/products", async (req) => {
        const tenantSlug: string | undefined = (req as any).tenantSlug;
        const tenantId = (req as any).tenantId as bigint;

        const q = z
            .object({
                q: z.string().optional(),
                take: z.coerce.number().min(1).max(100).default(20),
            })
            .parse(req.query);

        const where: Prisma.mallRN_goodsWhereInput = buildPublicGoodsWhere(tenantId);

        if (q.q?.trim()) {
            const keyword = q.q.trim();
            where.OR = [
                { name: { contains: keyword } },
                { explains: { contains: keyword } },
                { detail: { contains: keyword } },
            ];
        }

        const rows = await app.prisma.mallRN_goods.findMany({
            where,
            orderBy: [
                { tenant_id: "desc" },
                { sale_start_at: "desc" },
                { sort_order: "desc" },
                { moddate: "desc" },
                { uid: "desc" },
            ],
            take: q.take,
            select: {
                uid: true,
                tenant_id: true,
                name: true,
                price: true,
                image1: true,
                image2: true,
                image3: true,
                pickup_only: true,
                sale_start_at: true,
                sale_end_at: true,
            },
        });

        const items = rows.map((r) => {
            const thumb = goodsImageUrl(r.image1 || r.image2 || r.image3);
            const timeLeft = calcTimeLeftFromEnd(r.sale_end_at ?? null);

            return {
                id: toId(r.uid),
                title: String(r.name ?? ""),
                price: toNumber(r.price, 0),
                metaLeft: timeLeft,
                metaRight: r.pickup_only ? "픽업" : undefined,
                thumbnailUrl: thumb || undefined,
                sourceTenantId: r.tenant_id != null ? toId(r.tenant_id) : null,
            };
        });

        return {
            ok: true,
            tenant: tenantSlug,
            items,
        };
    });

    app.get("/v1/public/products/:id", async (req, reply) => {
        const tenantSlug: string | undefined = (req as any).tenantSlug;
        const tenantId = (req as any).tenantId as bigint;

        const params = z
            .object({
                id: z.string(),
            })
            .parse(req.params);

        const uid = Number(params.id);

        const row = await app.prisma.mallRN_goods.findFirst({
            where: {
                uid,
                ...buildPublicGoodsWhere(tenantId),
            },
            select: {
                uid: true,
                tenant_id: true,
                name: true,
                price: true,
                explains: true,
                detail: true,
                image1: true,
                image2: true,
                image3: true,
                other_image: true,
                option_use: true,
                option_info: true,
                option_soldout: true,
                pickup_only: true,
                sale_start_at: true,
                sale_end_at: true,
            },
        });

        if (!row) {
            reply.code(404).send({ ok: false });
            return;
        }

        const images = normalizeImages(row);
        const options = parseOptions(row);

        const desc =
            String(row.explains ?? "").trim() ||
            String(row.detail ?? "").trim() ||
            null;

        const product = {
            id: toId(row.uid),
            title: String(row.name ?? ""),
            price: toNumber(row.price, 0),
            description: desc,
            meta: {
                timeLeft: calcTimeLeftFromEnd(row.sale_end_at ?? null),
                pickup: row.pickup_only ? "픽업 상품" : undefined,
            },
            images,
            options,
            sourceTenantId: row.tenant_id != null ? toId(row.tenant_id) : null,
        };

        return {
            ok: true,
            tenant: tenantSlug,
            product,
        };
    });
}