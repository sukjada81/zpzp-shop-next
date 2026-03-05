// apps/api/src/modules/admin/products.routes.ts
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
    if (!Number.isFinite(n) || n <= 0) return { ok: false as const, error: "invalid id" };
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

export async function adminProductsRoutes(app: FastifyInstance) {
    // ✅ 통합 관리자: 지점 목록
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

    // ✅ 통합 관리자: 상품 목록
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
                    image2: true,
                    image1: true,
                    moddate: true,
                    signdate: true,
                    status: true,
                    pickup_only: true,
                },
            }),
        ]);

        const mapped = (rows as any[]).map((r) => ({
            id: String(r.uid),
            tenantId: r.tenant_id == null ? null : String(r.tenant_id),
            title: r.name,
            status: String(r.status ?? "draft"),
            basePrice: Number(r.price ?? 0),
            pickupOnly: !!r.pickup_only,
            thumbnailUrl: r.image2 || r.image1 || null,
            createdAt: unixToIso(r.signdate),
            updatedAt: unixToIso(r.moddate),
            tenant: undefined,
        }));

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

    // ✅ 상품 상세
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
            thumbnailUrl: row.image2 || row.image1 || null,
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
            options: [],
        };

        return reply.send({ ok: true, product: jsonSafe(product) });
    });

    // ✅ 상품 생성
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

        // ✅ Prisma 스키마에서 Text 필드가 required 인 것들 기본값 채움
        const created = await app.prisma.mallRN_goods.create({
            data: {
                tenant_id: tenant.id,
                name: title,

                // 필수 Text (required) 기본값
                other_image: "",
                detail_image: "",
                option_info: "",
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

                // 설명(필수 Text)
                explains: body.description == null ? "" : String(body.description),

                // 가격
                price: Math.max(0, Math.trunc(toNumberSafe(body.basePrice, 0))),

                // 확장 컬럼
                status: String(body.status ?? "draft").trim() || "draft",
                pickup_only: Boolean(body.pickupOnly ?? true),
                min_qty: toNullableInt(body.minQty),
                max_qty: toNullableInt(body.maxQty),
                sale_start_at: body.saleStartAt ? new Date(String(body.saleStartAt)) : null,
                sale_end_at: body.saleEndAt ? new Date(String(body.saleEndAt)) : null,
                sort_order: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
                deleted_at: null,

                // 운영 필터
                sale_use: 1,
                display_use: 1,
                auth_ck: "Y",
                moddate: nowSec,
                signdate: nowSec,
            },
            select: { uid: true },
        });

        return reply.send({ ok: true, product: jsonSafe({ id: String(created.uid) }) });
    });

    // ✅ 상품 수정
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
                explains: body.description == null ? "" : String(body.description),
                price: Math.max(0, Math.trunc(toNumberSafe(body.basePrice, 0))),

                status: String(body.status ?? "draft").trim() || "draft",
                pickup_only: Boolean(body.pickupOnly ?? true),
                min_qty: toNullableInt(body.minQty),
                max_qty: toNullableInt(body.maxQty),
                sale_start_at: body.saleStartAt ? new Date(String(body.saleStartAt)) : null,
                sale_end_at: body.saleEndAt ? new Date(String(body.saleEndAt)) : null,
                sort_order: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
                deleted_at: body.deletedAt ? new Date(String(body.deletedAt)) : null,

                moddate: Math.floor(Date.now() / 1000),
            },
            select: { uid: true },
        });

        return reply.send({ ok: true, product: jsonSafe({ id: String(updated.uid) }) });
    });
}