// apps/api/src/modules/admin/products.routes.ts
import type { FastifyInstance } from "fastify";
import { countActiveLinkersByProductIds } from "./linker-products.routes.js";

type AdminSession = {
    admin?: {
        id: string;
        email?: string | null;
        name: string;
        isSuperAdmin: boolean;
    };
};

const UI_CATEGORY_PREFIX = "ui:cat:";

function requireSuperAdmin(req: any, reply: any) {
    const admin = (req.session as AdminSession | undefined)?.admin;
    if (!admin?.isSuperAdmin) {
        reply.code(401);
        return reply.send({ ok: false, message: "unauthorized" });
    }
    return null;
}

function jsonSafe<T>(v: T): any {
    if (v === null || v === undefined) return v;

    const t = typeof v;
    if (t === "bigint") return (v as unknown as bigint).toString();
    if (t !== "object") return v;

    if (v instanceof Date) return v.toISOString();

    const ctorName = (v as any)?.constructor?.name;
    if (ctorName === "Decimal" && typeof (v as any).toString === "function") {
        return (v as any).toString();
    }

    if (Array.isArray(v)) return v.map(jsonSafe);

    const out: any = {};
    for (const [k, val] of Object.entries(v as any)) out[k] = jsonSafe(val);
    return out;
}

function parseIntId(raw: unknown) {
    const s = String(raw ?? "").trim();
    if (!s) return { ok: false as const, error: "id required" };
    if (!/^\d+$/.test(s)) return { ok: false as const, error: "invalid id" };
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0) return { ok: false as const, value: 0, error: "invalid id" };
    return { ok: true as const, value: n };
}

function isHqTenantSlug(raw: unknown) {
    const s = String(raw ?? "").trim().toLowerCase();
    return s === "hq" || s === "head" || s === "0" || s === "root";
}

async function resolveTenantId(app: FastifyInstance, tenantSlugRaw: unknown) {
    const tenantSlug = String(tenantSlugRaw ?? "").trim();

    if (!tenantSlug) {
        return { ok: false as const, error: "tenantSlug required" };
    }

    if (isHqTenantSlug(tenantSlug)) {
        return { ok: true as const, tenantId: BigInt(0), tenantSlug: "hq" };
    }

    const tenant = await app.prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true, slug: true },
    });

    if (!tenant) {
        return { ok: false as const, error: "invalid tenantSlug" };
    }

    return { ok: true as const, tenantId: tenant.id, tenantSlug: tenant.slug };
}

function toNullableInt(v: any): number | null {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.trunc(n));
}

function toNonNegInt(v: any, fallback = 0) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.trunc(n));
}

function toNonNegBigInt(v: any, fallback: bigint = BigInt(0)) {
    if (v === "" || v === null || v === undefined) return fallback;

    const s = String(v).trim();
    if (!/^\d+$/.test(s)) return fallback;

    try {
        const n = BigInt(s);
        return n >= BigInt(0) ? n : fallback;
    } catch {
        return fallback;
    }
}

function unixToIso(u: any): string | null {
    const n = Number(u);
    if (!Number.isFinite(n) || n <= 0) return null;
    return new Date(n * 1000).toISOString();
}

function normalizeImagePath(v: any): string {
    const s = String(v ?? "").trim();
    if (!s) return "";
    return s.replace(/\\/g, "/").replace(/^\/+/, "");
}

function normalizeText(v: any): string {
    return String(v ?? "");
}

function normalizeTrimmed(v: any): string {
    return String(v ?? "").trim();
}

function parseDateTime(v: any): Date | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

function toTinyIntBool(...values: any[]): number {
    for (const v of values) {
        if (v === undefined || v === null) continue;

        if (typeof v === "boolean") return v ? 1 : 0;
        if (typeof v === "number") return v ? 1 : 0;

        const s = String(v).trim().toLowerCase();
        if (["1", "true", "y", "yes", "on"].includes(s)) return 1;
        if (["0", "false", "n", "no", "off", ""].includes(s)) return 0;
    }
    return 0;
}

function toCsvText(v: any): string {
    if (Array.isArray(v)) {
        return v
            .map((x) => normalizeImagePath(x))
            .filter(Boolean)
            .join(",");
    }

    const s = String(v ?? "").trim();
    if (!s) return "";

    return s
        .split(/\r?\n|,/g)
        .map((x) => normalizeImagePath(x))
        .filter(Boolean)
        .join(",");
}

function fromCsvText(v: any): string[] {
    const s = String(v ?? "").trim();
    if (!s) return [];
    return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
}

function parseCategoryKeysFromIcon(icon: any): string[] {
    const raw = String(icon ?? "").trim();
    if (!raw) return [];

    return raw
        .split("|")
        .map((x) => x.trim())
        .filter((x) => x.startsWith(UI_CATEGORY_PREFIX))
        .map((x) => x.slice(UI_CATEGORY_PREFIX.length))
        .filter(Boolean);
}

function mergeCategoryKeysIntoIcon(existingIcon: any, categoryKeys: any): string {
    const baseTokens = String(existingIcon ?? "")
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean)
        .filter((x) => !x.startsWith(UI_CATEGORY_PREFIX));

    const keys = Array.isArray(categoryKeys)
        ? categoryKeys.map((x) => String(x).trim()).filter(Boolean)
        : [];

    const uiTokens = keys.map((key) => `${UI_CATEGORY_PREFIX}${key}`);
    return [...baseTokens, ...uiTokens].join("|");
}

function buildAdminProduct(row: any) {
    return {
        id: String(row.uid),
        tenantId: row.tenant_id == null ? null : String(row.tenant_id),
        tenantSlug: row.tenant_id === BigInt(0) || row.tenant_id === 0 ? "hq" : (row.tenant?.slug ?? ""),

        title: row.name,
        status: String(row.status ?? "draft"),

        price: Number(row.price ?? 0),
        basePrice: Number(row.price ?? 0),
        origPrice: Number(row.orig_price ?? 0),
        consumerPrice: Number(row.consumer_price ?? 0),

        image1: row.image1 || "",
        image2: row.image2 || "",
        image3: row.image3 || "",
        thumbnailUrl: row.image1 || row.image2 || row.image3 || null,

        otherImages: fromCsvText(row.other_image),
        detailImages: fromCsvText(row.detail_image),

        description: String(row.explains ?? ""),
        explains: String(row.explains ?? ""),
        detail: String(row.detail ?? ""),
        shortDescription: String(row.detail ?? ""),

        pickupOnly: Number(row.pickup_only ?? 0) === 1,
        displayUse: Number(row.display_use ?? 0) === 1,
        saleUse: Number(row.sale_use ?? 0) === 1,

        minQty: row.min_qty ?? null,
        maxQty: row.max_qty ?? null,
        saleStartAt: row.sale_start_at ?? null,
        saleEndAt: row.sale_end_at ?? null,
        sortOrder: row.sort_order ?? 0,

        optionUse: Number(row.option_use ?? 0) === 1,
        optionInfo: String(row.option_info ?? ""),

        qtyType: Number(row.qty_type ?? 0),
        qty: Number(row.qty ?? 0),
        limitQty: Number(row.limit_qty ?? 0),

        goodsCode: String(row.goods_code ?? ""),
        brand: String(row.brand ?? ""),
        make: String(row.make ?? ""),
        origin: String(row.origin ?? ""),
        model: String(row.model ?? ""),

        detailImageOnly: Number(row.detail_image_only ?? 0) === 1,
        detailImageType: Number(row.detail_image_type ?? 1),

        cate: row.cate == null ? "0" : String(row.cate),
        categoryKeys: parseCategoryKeysFromIcon(row.icon),

        createdAt: unixToIso(row.signdate),
        updatedAt: unixToIso(row.moddate),
        deletedAt: row.deleted_at ?? null,
    };
}

export async function adminProductsRoutes(app: FastifyInstance) {
    app.get("/admin/tenants", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const rows = await app.prisma.tenant.findMany({
            where: { status: "active" },
            orderBy: { id: "asc" },
            select: { id: true, slug: true, name: true, status: true },
        });

        return reply.send({ ok: true, rows: jsonSafe(rows) });
    });

    app.get("/admin/products", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const q = (req.query ?? {}) as any;

        const tenantSlug = String(q.tenant ?? "all").trim() || "all";
        const keyword = q.q ? String(q.q).trim() : "";
        const status = q.status ? String(q.status).trim() : "";

        const page = Math.max(1, Number(q.page ?? 1) || 1);
        const limit = Math.min(100, Math.max(1, Number(q.limit ?? q.pageSize ?? 20) || 20));
        const skip = (page - 1) * limit;

        const where: any = { deleted_at: null };

        if (tenantSlug !== "all") {
            if (isHqTenantSlug(tenantSlug)) {
                where.tenant_id = BigInt(0);
            } else {
                const tenant = await app.prisma.tenant.findUnique({
                    where: { slug: tenantSlug },
                    select: { id: true },
                });
                if (!tenant) return reply.code(400).send({ ok: false, message: "invalid tenant" });
                where.tenant_id = tenant.id;
            }
        }

        if (status) where.status = status;

        if (keyword) {
            where.OR = [
                { name: { contains: keyword } },
                { explains: { contains: keyword } },
                { detail: { contains: keyword } },
                { brand: { contains: keyword } },
                { make: { contains: keyword } },
                { origin: { contains: keyword } },
                { model: { contains: keyword } },
                { goods_code: { contains: keyword } },
            ];
        }

        const [total, rows] = await Promise.all([
            app.prisma.mallRN_goods.count({ where }),
            app.prisma.mallRN_goods.findMany({
                where,
                orderBy: [{ sort_order: "desc" }, { moddate: "desc" }, { uid: "desc" }],
                skip,
                take: limit,
                select: {
                    uid: true,
                    tenant_id: true,
                    cate: true,
                    name: true,
                    price: true,
                    image1: true,
                    image2: true,
                    image3: true,
                    moddate: true,
                    signdate: true,
                    status: true,
                    pickup_only: true,
                    display_use: true,
                    sale_use: true,
                    icon: true,
                },
            }),
        ]);

        const tenantIds = Array.from(
            new Set(
                rows
                    .map((r: any) => r.tenant_id)
                    .filter((v: any) => v !== null && v !== undefined && String(v) !== "0")
                    .map((v: any) => String(v))
            )
        );

        const tenantRows =
            tenantIds.length > 0
                ? await app.prisma.tenant.findMany({
                    where: {
                        id: { in: tenantIds.map((v) => BigInt(v)) },
                    },
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                    },
                })
                : [];

        const tenantMap = new Map(
            tenantRows.map((t: any) => [
                String(t.id),
                {
                    id: String(t.id),
                    slug: t.slug ?? null,
                    name: t.name ?? null,
                },
            ])
        );

        const linkerCountMap = await countActiveLinkersByProductIds(
            app,
            (rows as any[]).map((r) => Number(r.uid))
        );

        const mapped = (rows as any[]).map((r) => {
            const isHq = String(r.tenant_id ?? "") === "0";
            const tenant = !isHq && r.tenant_id != null ? tenantMap.get(String(r.tenant_id)) ?? null : null;

            return {
                id: String(r.uid),
                tenantId: r.tenant_id == null ? null : String(r.tenant_id),
                tenantName: isHq ? "본사 상품" : (tenant?.name ?? null),
                tenantSlug: isHq ? "hq" : (tenant?.slug ?? null),
                tenant: isHq
                    ? { id: "0", slug: "hq", name: "본사 상품" }
                    : tenant,

                title: r.name,
                status: String(r.status ?? "draft"),
                basePrice: Number(r.price ?? 0),

                pickupOnly: Number(r.pickup_only ?? 0) === 1,
                displayUse: Number(r.display_use ?? 0) === 1,
                saleUse: Number(r.sale_use ?? 0) === 1,
                cate: r.cate == null ? "0" : String(r.cate),
                categoryKeys: parseCategoryKeysFromIcon(r.icon),

                image1: r.image1 || "",
                image2: r.image2 || "",
                image3: r.image3 || "",
                thumbnailUrl: r.image1 || r.image2 || r.image3 || null,

                linkerCount: linkerCountMap.get(Number(r.uid)) ?? 0,

                createdAt: unixToIso(r.signdate),
                updatedAt: unixToIso(r.moddate),
            };
        });

        return reply.send(
            jsonSafe({
                ok: true,
                total,
                page,
                limit,
                pageSize: limit,
                rows: mapped,
                items: mapped,
            })
        );
    });

    app.get("/admin/products/:id", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const parsed = parseIntId(req.params?.id);
        if (!parsed.ok) return reply.code(400).send({ ok: false, message: parsed.error });

        const row = await app.prisma.mallRN_goods.findUnique({
            where: { uid: parsed.value },
            select: {
                uid: true,
                tenant_id: true,
                cate: true,
                name: true,
                price: true,
                orig_price: true,
                consumer_price: true,
                explains: true,
                detail: true,
                image1: true,
                image2: true,
                image3: true,
                other_image: true,
                detail_image: true,
                detail_image_only: true,
                detail_image_type: true,
                option_use: true,
                option_info: true,
                moddate: true,
                signdate: true,
                status: true,
                pickup_only: true,
                display_use: true,
                sale_use: true,
                min_qty: true,
                max_qty: true,
                sale_start_at: true,
                sale_end_at: true,
                sort_order: true,
                deleted_at: true,
                qty_type: true,
                qty: true,
                limit_qty: true,
                goods_code: true,
                brand: true,
                make: true,
                origin: true,
                model: true,
                icon: true,
            },
        });

        if (!row) return reply.code(404).send({ ok: false, message: "not found" });

        const tenant =
            String(row.tenant_id ?? "") === "0"
                ? null
                : row.tenant_id != null
                    ? await app.prisma.tenant.findUnique({
                        where: { id: row.tenant_id },
                        select: { slug: true, name: true },
                    })
                    : null;

        return reply.send({
            ok: true,
            product: jsonSafe(
                buildAdminProduct({
                    ...row,
                    tenant,
                })
            ),
        });
    });

    app.post("/admin/products", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const body = (req.body ?? {}) as any;

        const resolvedTenant = await resolveTenantId(app, body.tenantSlug);
        if (!resolvedTenant.ok) {
            return reply.code(400).send({ ok: false, message: resolvedTenant.error });
        }

        const title = String(body.title ?? "").trim();
        if (!title) return reply.code(400).send({ ok: false, message: "title required" });

        const nowSec = Math.floor(Date.now() / 1000);

        const created = await app.prisma.mallRN_goods.create({
            data: {
                tenant_id: resolvedTenant.tenantId,
                cate: toNonNegBigInt(body.cate, BigInt(0)),
                name: title,

                explains: normalizeText(body.explains ?? body.description ?? ""),
                detail: normalizeText(body.detail ?? body.shortDescription ?? ""),

                price: toNonNegInt(body.basePrice ?? body.price, 0),
                orig_price: toNonNegInt(body.origPrice ?? body.orig_price, 0),
                consumer_price: toNonNegInt(body.consumerPrice ?? body.consumer_price, 0),

                image1: normalizeImagePath(body.image1),
                image2: normalizeImagePath(body.image2),
                image3: normalizeImagePath(body.image3),
                other_image: toCsvText(body.otherImages ?? body.other_image),
                detail_image: toCsvText(body.detailImages ?? body.detail_image),

                detail_image_only: toTinyIntBool(body.detailImageOnly, body.detail_image_only),
                detail_image_type: toNonNegInt(body.detailImageType ?? body.detail_image_type, 1) === 2 ? 2 : 1,

                status: String(body.status ?? "draft").trim() || "draft",
                pickup_only: !!toTinyIntBool(body.pickupOnly, body.pickup_only),
                display_use: toTinyIntBool(body.displayUse, body.display_use),
                sale_use: toTinyIntBool(body.saleUse, body.sale_use),

                min_qty: toNullableInt(body.minQty ?? body.min_qty),
                max_qty: toNullableInt(body.maxQty ?? body.max_qty),
                sale_start_at: parseDateTime(body.saleStartAt ?? body.sale_start_at),
                sale_end_at: parseDateTime(body.saleEndAt ?? body.sale_end_at),
                sort_order: toNonNegInt(body.sortOrder ?? body.sort_order, 0),

                option_use: toTinyIntBool(body.optionUse, body.option_use),
                option_info: normalizeText(body.optionInfo ?? body.option_info ?? ""),

                qty_type: toNonNegInt(body.qtyType ?? body.qty_type, 0) === 1 ? 1 : 0,
                qty: toNonNegInt(body.qty, 0),
                limit_qty: toNonNegInt(body.limitQty ?? body.limit_qty, 0),

                goods_code: normalizeTrimmed(body.goodsCode),
                brand: normalizeTrimmed(body.brand),
                make: normalizeTrimmed(body.make),
                origin: normalizeTrimmed(body.origin),
                model: normalizeTrimmed(body.model),

                icon: mergeCategoryKeysIntoIcon("", body.categoryKeys),

                require_info: "",
                making_info: "",
                mileage_level: "",
                delivery_info: "",
                refund_info: "",
                exchange_info: "",
                as_info: "",
                exhibition: "",
                keyword: "",

                auth_ck: "Y",
                moddate: nowSec,
                signdate: nowSec,
            },
            select: { uid: true, cate: true },
        });

        return reply.send({
            ok: true,
            product: jsonSafe({
                id: String(created.uid),
                cate: String(created.cate ?? 0),
            }),
        });
    });

    app.put("/admin/products/:id", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const parsed = parseIntId(req.params?.id);
        if (!parsed.ok) return reply.code(400).send({ ok: false, message: parsed.error });

        const body = (req.body ?? {}) as any;

        const title = String(body.title ?? "").trim();
        if (!title) return reply.code(400).send({ ok: false, message: "title required" });

        const resolvedTenant = await resolveTenantId(app, body.tenantSlug);
        if (!resolvedTenant.ok) {
            return reply.code(400).send({ ok: false, message: resolvedTenant.error });
        }

        const exists = await app.prisma.mallRN_goods.findUnique({
            where: { uid: parsed.value },
            select: { uid: true, icon: true },
        });
        if (!exists) return reply.code(404).send({ ok: false, message: "not found" });

        const updated = await app.prisma.mallRN_goods.update({
            where: { uid: parsed.value },
            data: {
                tenant_id: resolvedTenant.tenantId,
                cate: toNonNegBigInt(body.cate, BigInt(0)),
                name: title,

                explains: normalizeText(body.explains ?? body.description ?? ""),
                detail: normalizeText(body.detail ?? body.shortDescription ?? ""),

                price: toNonNegInt(body.basePrice ?? body.price, 0),
                orig_price: toNonNegInt(body.origPrice ?? body.orig_price, 0),
                consumer_price: toNonNegInt(body.consumerPrice ?? body.consumer_price, 0),

                image1: normalizeImagePath(body.image1),
                image2: normalizeImagePath(body.image2),
                image3: normalizeImagePath(body.image3),
                other_image: toCsvText(body.otherImages ?? body.other_image),
                detail_image: toCsvText(body.detailImages ?? body.detail_image),

                detail_image_only: toTinyIntBool(body.detailImageOnly, body.detail_image_only),
                detail_image_type: toNonNegInt(body.detailImageType ?? body.detail_image_type, 1) === 2 ? 2 : 1,

                status: String(body.status ?? "draft").trim() || "draft",
                pickup_only: !!toTinyIntBool(body.pickupOnly, body.pickup_only),
                display_use: toTinyIntBool(body.displayUse, body.display_use),
                sale_use: toTinyIntBool(body.saleUse, body.sale_use),

                min_qty: toNullableInt(body.minQty ?? body.min_qty),
                max_qty: toNullableInt(body.maxQty ?? body.max_qty),
                sale_start_at: parseDateTime(body.saleStartAt ?? body.sale_start_at),
                sale_end_at: parseDateTime(body.saleEndAt ?? body.sale_end_at),
                sort_order: toNonNegInt(body.sortOrder ?? body.sort_order, 0),

                option_use: toTinyIntBool(body.optionUse, body.option_use),
                option_info: normalizeText(body.optionInfo ?? body.option_info ?? ""),

                qty_type: toNonNegInt(body.qtyType ?? body.qty_type, 0) === 1 ? 1 : 0,
                qty: toNonNegInt(body.qty, 0),
                limit_qty: toNonNegInt(body.limitQty ?? body.limit_qty, 0),

                goods_code: normalizeTrimmed(body.goodsCode),
                brand: normalizeTrimmed(body.brand),
                make: normalizeTrimmed(body.make),
                origin: normalizeTrimmed(body.origin),
                model: normalizeTrimmed(body.model),

                icon: mergeCategoryKeysIntoIcon(exists.icon ?? "", body.categoryKeys),

                moddate: Math.floor(Date.now() / 1000),
            },
            select: { uid: true, tenant_id: true, cate: true },
        });

        return reply.send({
            ok: true,
            product: jsonSafe({
                id: String(updated.uid),
                tenantId: String(updated.tenant_id ?? ""),
                tenantSlug: resolvedTenant.tenantSlug,
                cate: String(updated.cate ?? 0),
            }),
        });
    });
}