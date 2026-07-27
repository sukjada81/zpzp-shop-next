import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";

type AdminSession = {
    admin?: {
        id: string;
        isSuperAdmin: boolean;
    };
};

function requireSuperAdmin(req: any, reply: any) {
    const admin = (req.session as AdminSession | undefined)?.admin;
    if (!admin?.isSuperAdmin) {
        reply.code(401);
        return reply.send({ ok: false, message: "unauthorized" });
    }
    return null;
}

function parseIntId(raw: unknown) {
    const s = String(raw ?? "").trim();
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    return Number.isInteger(n) && n > 0 ? n : null;
}

function isSelling(row: {
    status: string;
    sale_use: number;
    deleted_at: Date | null;
    sale_end_at: Date | null;
}) {
    return (
        row.status === "published"
        && row.sale_use === 1
        && row.deleted_at == null
        && (!row.sale_end_at || row.sale_end_at.getTime() >= Date.now())
    );
}

function goodsImageUrl(raw: string | null | undefined) {
    const value = String(raw ?? "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    const base = (process.env.GOODS_IMAGE_BASE_URL || "https://zpzp.kr").replace(/\/+$/, "");
    return `${base}/image/goods/img${value.replace(/^\/+/, "")}`;
}

/** 스토어에 실제 노출 중인 선택 상품 조건 */
const ACTIVE_SELECTION_WHERE = {
    selection_status: "selected",
    display_status: "visible",
} as const;

export async function countActiveLinkersByProductIds(
    app: FastifyInstance,
    productIds: number[]
): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (productIds.length === 0) return map;

    const rows = await app.prisma.$queryRaw<Array<{ product_uid: number; cnt: bigint }>>(Prisma.sql`
        SELECT lp.product_uid, COUNT(DISTINCT lp.linker_uid) AS cnt
          FROM mallRN_linker_products lp
          JOIN zpzp_linker l ON l.uid = lp.linker_uid AND l.status = 'active'
         WHERE lp.product_uid IN (${Prisma.join(productIds)})
           AND lp.selection_status = 'selected'
           AND lp.display_status = 'visible'
         GROUP BY lp.product_uid
    `);

    for (const row of rows) {
        map.set(Number(row.product_uid), Number(row.cnt));
    }
    return map;
}

export async function adminLinkerProductsRoutes(app: FastifyInstance) {
    /** 링커 목록 + 등록(진열) 상품 수 */
    app.get("/admin/linker-products/linkers", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const q = (req.query ?? {}) as any;
        const keyword = String(q.q ?? "").trim().toLowerCase();
        const page = Math.max(1, Number(q.page ?? 1) || 1);
        const limit = Math.min(100, Math.max(1, Number(q.limit ?? q.pageSize ?? 20) || 20));
        const skip = (page - 1) * limit;

        const where: any = { status: "active" };
        if (keyword) {
            where.OR = [
                { shop_slug: { contains: keyword } },
                { shop_name: { contains: keyword } },
            ];
        }

        const [total, linkers] = await Promise.all([
            app.prisma.zpzp_linker.count({ where }),
            app.prisma.zpzp_linker.findMany({
                where,
                orderBy: [{ shop_slug: "asc" }],
                skip,
                take: limit,
                select: {
                    uid: true,
                    shop_slug: true,
                    shop_name: true,
                    status: true,
                    approved_at: true,
                },
            }),
        ]);

        const linkerUids = linkers.map((row) => row.uid);
        const [registeredCounts, activeCounts] = linkerUids.length
            ? await Promise.all([
                app.prisma.mallRN_linker_products.groupBy({
                    by: ["linker_uid"],
                    where: {
                        linker_uid: { in: linkerUids },
                        selection_status: "selected",
                    },
                    _count: { product_uid: true },
                }),
                app.prisma.mallRN_linker_products.groupBy({
                    by: ["linker_uid"],
                    where: {
                        linker_uid: { in: linkerUids },
                        ...ACTIVE_SELECTION_WHERE,
                    },
                    _count: { product_uid: true },
                }),
            ])
            : [[], []];

        const registeredMap = new Map(registeredCounts.map((row) => [row.linker_uid, row._count.product_uid]));
        const activeMap = new Map(activeCounts.map((row) => [row.linker_uid, row._count.product_uid]));

        return reply.send({
            ok: true,
            total,
            page,
            pageSize: limit,
            items: linkers.map((linker) => ({
                uid: linker.uid,
                shopSlug: linker.shop_slug,
                shopName: linker.shop_name,
                status: linker.status,
                approvedAt: linker.approved_at?.toISOString?.() ?? null,
                registeredProductCount: registeredMap.get(linker.uid) ?? 0,
                activeProductCount: activeMap.get(linker.uid) ?? 0,
            })),
        });
    });

    /** 링커별 등록 상품 상세 */
    app.get("/admin/linker-products/linkers/:linkerUid/products", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const linkerUid = parseIntId(req.params?.linkerUid);
        if (!linkerUid) return reply.code(400).send({ ok: false, message: "invalid linkerUid" });

        const linker = await app.prisma.zpzp_linker.findUnique({
            where: { uid: linkerUid },
            select: { uid: true, shop_slug: true, shop_name: true, status: true },
        });
        if (!linker) return reply.code(404).send({ ok: false, message: "linker not found" });

        const selections = await app.prisma.mallRN_linker_products.findMany({
            where: { linker_uid: linkerUid, selection_status: "selected" },
            orderBy: [{ display_order: "asc" }, { selected_at: "desc" }],
        });

        const products = selections.length
            ? await app.prisma.mallRN_goods.findMany({
                where: { uid: { in: selections.map((row) => row.product_uid) } },
                select: {
                    uid: true,
                    name: true,
                    price: true,
                    image1: true,
                    status: true,
                    sale_use: true,
                    deleted_at: true,
                    sale_end_at: true,
                },
            })
            : [];
        const productMap = new Map(products.map((row) => [row.uid, row]));

        const items = selections
            .map((selection) => {
                const product = productMap.get(selection.product_uid);
                if (!product) return null;
                const selling = isSelling(product);
                const storeVisible = selection.display_status === "visible" && selling;
                return {
                    productId: String(product.uid),
                    name: product.name,
                    price: Number(product.price ?? 0),
                    image: goodsImageUrl(product.image1),
                    displayStatus: selection.display_status,
                    displayOrder: selection.display_order,
                    selectedAt: selection.selected_at.toISOString(),
                    productStatus: selling ? "판매 중" : "판매 중지",
                    storeVisible,
                };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item));

        return reply.send({
            ok: true,
            linker: {
                uid: linker.uid,
                shopSlug: linker.shop_slug,
                shopName: linker.shop_name,
                status: linker.status,
            },
            total: items.length,
            activeCount: items.filter((item) => item.storeVisible).length,
            items,
        });
    });

    /** 상품별 진열 링커 상세 */
    app.get("/admin/linker-products/products/:productUid/linkers", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const productUid = parseIntId(req.params?.productUid);
        if (!productUid) return reply.code(400).send({ ok: false, message: "invalid productUid" });

        const product = await app.prisma.mallRN_goods.findUnique({
            where: { uid: productUid },
            select: {
                uid: true,
                name: true,
                price: true,
                image1: true,
                status: true,
                sale_use: true,
                deleted_at: true,
                sale_end_at: true,
            },
        });
        if (!product) return reply.code(404).send({ ok: false, message: "product not found" });

        const selections = await app.prisma.mallRN_linker_products.findMany({
            where: {
                product_uid: productUid,
                selection_status: "selected",
            },
            orderBy: [{ display_order: "asc" }, { selected_at: "desc" }],
        });

        const linkers = selections.length
            ? await app.prisma.zpzp_linker.findMany({
                where: { uid: { in: selections.map((row) => row.linker_uid) } },
                select: { uid: true, shop_slug: true, shop_name: true, status: true },
            })
            : [];
        const linkerMap = new Map(linkers.map((row) => [row.uid, row]));
        const selling = isSelling(product);

        const items = selections
            .map((selection) => {
                const linker = linkerMap.get(selection.linker_uid);
                if (!linker) return null;
                const storeVisible = linker.status === "active"
                    && selection.display_status === "visible"
                    && selling;
                return {
                    linkerUid: linker.uid,
                    shopSlug: linker.shop_slug,
                    shopName: linker.shop_name,
                    linkerStatus: linker.status,
                    displayStatus: selection.display_status,
                    displayOrder: selection.display_order,
                    selectedAt: selection.selected_at.toISOString(),
                    storeVisible,
                };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item));

        return reply.send({
            ok: true,
            product: {
                id: String(product.uid),
                name: product.name,
                price: Number(product.price ?? 0),
                image: goodsImageUrl(product.image1),
                productStatus: selling ? "판매 중" : "판매 중지",
            },
            total: items.length,
            activeCount: items.filter((item) => item.storeVisible).length,
            items,
        });
    });
}
