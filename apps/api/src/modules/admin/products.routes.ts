import type { FastifyInstance } from "fastify";

type AdminSession = {
    admin?: {
        id: string;
        email?: string | null;
        name: string;
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

function toNullableInt(v: any): number | null {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
}

function toNumberSafe(v: any, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function unixToIso(u: any): string | null {
    const n = Number(u);
    if (!Number.isFinite(n) || n <= 0) return null;
    return new Date(n * 1000).toISOString();
}

function normalizeImagePath(v: any): string {
    const s = String(v ?? "").trim();
    if (!s) return "";
    return s;
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

        const page = Math.max(1, Number(q.page ?? 1) || 1);
        const limit = Math.min(100, Math.max(1, Number(q.limit ?? q.pageSize ?? 20) || 20));
        const skip = (page - 1) * limit;

        let tenantId: bigint | null = null;
        if (tenantSlug !== "all") {
            const tenant = await app.prisma.tenant.findUnique({
                where: { slug: tenantSlug },
                select: { id: true },
            });
            if (!tenant) return reply.code(400).send({ ok: false, message: "invalid tenant" });
            tenantId = tenant.id;
        }

        const where: any = { deleted_at: null };
        if (tenantId) where.tenant_id = tenantId;

        if (keyword) {
            where.OR = [
                { name: { contains: keyword } },
                { explains: { contains: keyword } },
                { detail: { contains: keyword } },
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
                    name: true,
                    price: true,
                    image1: true,
                    image2: true,
                    image3: true,
                    moddate: true,
                    signdate: true,
                    status: true,
                    pickup_only: true,
                },
            }),
        ]);

        const tenantIds = Array.from(
            new Set(
                rows
                    .map((r: any) => r.tenant_id)
                    .filter((v: any) => v !== null && v !== undefined)
                    .map((v: any) => String(v))
            )
        );

        const tenantRows =
            tenantIds.length > 0
                ? await app.prisma.tenant.findMany({
                    where: {
                        id: {
                            in: tenantIds.map((v) => BigInt(v)),
                        },
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

        const mapped = (rows as any[]).map((r) => {
            const tenant = r.tenant_id != null ? tenantMap.get(String(r.tenant_id)) ?? null : null;

            return {
                id: String(r.uid),
                tenantId: r.tenant_id == null ? null : String(r.tenant_id),
                tenantName: tenant?.name ?? null,
                tenantSlug: tenant?.slug ?? null,
                tenant,
                title: r.name,
                status: String(r.status ?? "draft"),
                basePrice: Number(r.price ?? 0),
                pickupOnly: !!r.pickup_only,
                image1: r.image1 || "",
                image2: r.image2 || "",
                image3: r.image3 || "",
                thumbnailUrl: r.image1 || r.image2 || r.image3 || null,
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
                name: true,
                price: true,
                explains: true,
                detail: true,
                image1: true,
                image2: true,
                image3: true,
                other_image: true,
                detail_image: true,
                option_use: true,
                option_info: true,
                option_soldout: true,
                moddate: true,
                signdate: true,
                status: true,
                pickup_only: true,
                min_qty: true,
                max_qty: true,
                sale_start_at: true,
                sale_end_at: true,
                sort_order: true,
                deleted_at: true,
            },
        });

        if (!row) return reply.code(404).send({ ok: false, message: "not found" });

        const product = {
            id: String(row.uid),
            tenantId: row.tenant_id == null ? null : String(row.tenant_id),
            title: row.name,
            description: String(row.explains ?? "").trim() || String(row.detail ?? "").trim() || null,
            status: String(row.status ?? "draft"),
            image1: row.image1 || "",
            image2: row.image2 || "",
            image3: row.image3 || "",
            thumbnailUrl: row.image1 || row.image2 || row.image3 || null,
            basePrice: Number(row.price ?? 0),
            pickupOnly: !!row.pickup_only,
            minQty: row.min_qty ?? null,
            maxQty: row.max_qty ?? null,
            saleStartAt: row.sale_start_at ?? null,
            saleEndAt: row.sale_end_at ?? null,
            createdAt: unixToIso(row.signdate),
            updatedAt: unixToIso(row.moddate),
            sortOrder: row.sort_order ?? 0,
            deletedAt: row.deleted_at ?? null,
            optionUse: Number(row.option_use ?? 0) === 1,
            optionInfo: String(row.option_info ?? ""),
            options: [],
        };

        return reply.send({ ok: true, product: jsonSafe(product) });
    });

    app.post("/admin/products", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const body = (req.body ?? {}) as any;

        const tenantSlug = String(body.tenantSlug ?? "").trim();
        if (!tenantSlug) return reply.code(400).send({ ok: false, message: "tenantSlug required" });

        const tenant = await app.prisma.tenant.findUnique({
            where: { slug: tenantSlug },
            select: { id: true },
        });
        if (!tenant) return reply.code(400).send({ ok: false, message: "invalid tenantSlug" });

        const title = String(body.title ?? "").trim();
        if (!title) return reply.code(400).send({ ok: false, message: "title required" });

        const nowSec = Math.floor(Date.now() / 1000);

        const created = await app.prisma.mallRN_goods.create({
            data: {
                tenant_id: tenant.id,
                name: title,

                other_image: "",
                detail_image: "",
                option_info: String(body.optionInfo ?? body.option_info ?? ""),
                require_info: "",
                detail: "",
                making_info: "",
                mileage_level: "",
                delivery_info: "",
                refund_info: "",
                exchange_info: "",
                as_info: "",
                exhibition: "",
                keyword: "",

                explains:
                    body.description != null
                        ? String(body.description)
                        : body.explains != null
                            ? String(body.explains)
                            : "",

                price: Math.max(0, Math.trunc(toNumberSafe(body.basePrice ?? body.price, 0))),
                orig_price: Math.max(0, Math.trunc(toNumberSafe(body.orig_price ?? body.origPrice, 0))),
                consumer_price: Math.max(
                    0,
                    Math.trunc(toNumberSafe(body.consumer_price ?? body.consumerPrice, 0))
                ),

                image1: normalizeImagePath(body.image1 ?? body.thumbnailUrl),
                image2: normalizeImagePath(body.image2),
                image3: normalizeImagePath(body.image3),

                status: String(body.status ?? "draft").trim() || "draft",
                pickup_only: Boolean(body.pickupOnly ?? body.pickup_only ?? true),
                min_qty: toNullableInt(body.minQty ?? body.min_qty),
                max_qty: toNullableInt(body.maxQty ?? body.max_qty),
                sale_start_at: body.saleStartAt ? new Date(String(body.saleStartAt)) : null,
                sale_end_at: body.saleEndAt ? new Date(String(body.saleEndAt)) : null,
                sort_order: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
                deleted_at: null,

                option_use: Number(body.optionUse ?? body.option_use ? 1 : 0),
                sale_use: Number(body.saleUse ?? body.sale_use ? 1 : 0),
                display_use: Number(body.displayUse ?? body.display_use ? 1 : 0),
                auth_ck: "Y",
                moddate: nowSec,
                signdate: nowSec,
            },
            select: { uid: true },
        });

        return reply.send({ ok: true, product: jsonSafe({ id: String(created.uid) }) });
    });

    app.put("/admin/products/:id", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const parsed = parseIntId(req.params?.id);
        if (!parsed.ok) return reply.code(400).send({ ok: false, message: parsed.error });

        const body = (req.body ?? {}) as any;

        const title = String(body.title ?? "").trim();
        if (!title) return reply.code(400).send({ ok: false, message: "title required" });

        const exists = await app.prisma.mallRN_goods.findUnique({
            where: { uid: parsed.value },
            select: { uid: true },
        });
        if (!exists) return reply.code(404).send({ ok: false, message: "not found" });

        const updated = await app.prisma.mallRN_goods.update({
            where: { uid: parsed.value },
            data: {
                name: title,
                explains:
                    body.description != null
                        ? String(body.description)
                        : body.explains != null
                            ? String(body.explains)
                            : "",
                price: Math.max(0, Math.trunc(toNumberSafe(body.basePrice ?? body.price, 0))),
                orig_price: Math.max(0, Math.trunc(toNumberSafe(body.orig_price ?? body.origPrice, 0))),
                consumer_price: Math.max(
                    0,
                    Math.trunc(toNumberSafe(body.consumer_price ?? body.consumerPrice, 0))
                ),

                image1: normalizeImagePath(body.image1 ?? body.thumbnailUrl),
                image2: normalizeImagePath(body.image2),
                image3: normalizeImagePath(body.image3),

                status: String(body.status ?? "draft").trim() || "draft",
                pickup_only: Boolean(body.pickupOnly ?? body.pickup_only ?? true),
                min_qty: toNullableInt(body.minQty ?? body.min_qty),
                max_qty: toNullableInt(body.maxQty ?? body.max_qty),
                sale_start_at: body.saleStartAt ? new Date(String(body.saleStartAt)) : null,
                sale_end_at: body.saleEndAt ? new Date(String(body.saleEndAt)) : null,
                sort_order: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
                deleted_at: body.deletedAt ? new Date(String(body.deletedAt)) : null,

                option_use: Number(body.optionUse ?? body.option_use ? 1 : 0),
                option_info: String(body.optionInfo ?? body.option_info ?? ""),
                sale_use: Number(body.saleUse ?? body.sale_use ? 1 : 0),
                display_use: Number(body.displayUse ?? body.display_use ? 1 : 0),

                moddate: Math.floor(Date.now() / 1000),
            },
            select: { uid: true },
        });

        return reply.send({ ok: true, product: jsonSafe({ id: String(updated.uid) }) });
    });
}