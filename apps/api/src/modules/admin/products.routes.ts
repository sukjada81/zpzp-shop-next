// apps/api/src/modules/admin/products.routes.ts
import type { Prisma } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
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

/**
 * ✅ Prisma(BigInt/Decimal) -> JSON safe 변환기
 * - bigint: string 변환
 * - Decimal(Decimal.js): string 변환(안전)
 * - 객체/배열 재귀 변환
 */
function jsonSafe<T>(v: T): any {
    if (v === null || v === undefined) return v;

    const t = typeof v;
    if (t === "bigint") return (v as unknown as bigint).toString();
    if (t !== "object") return v;

    // Date
    if (v instanceof Date) return v.toISOString();

    // Decimal.js (Prisma Decimal)
    const ctorName = (v as any)?.constructor?.name;
    if (ctorName === "Decimal" && typeof (v as any).toString === "function") {
        return (v as any).toString();
    }

    if (Array.isArray(v)) return v.map(jsonSafe);

    const out: any = {};
    for (const [k, val] of Object.entries(v as any)) {
        out[k] = jsonSafe(val);
    }
    return out;
}

function parseBigIntParam(raw: unknown) {
    const s = String(raw ?? "").trim();
    if (!s) return { ok: false as const, error: "id required" };
    if (!/^\d+$/.test(s)) return { ok: false as const, error: "invalid id" };
    try {
        return { ok: true as const, value: BigInt(s) };
    } catch {
        return { ok: false as const, error: "invalid id" };
    }
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
    // GET /admin/products?tenant=all|{slug}&status=&q=&page=1&limit=20
    app.get("/admin/products", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const q = (req.query ?? {}) as any;

        const tenantSlug = String(q.tenant ?? "all").trim() || "all";
        const status = q.status ? String(q.status).trim() : "";
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
            tenantId = tenant.id as any;
        }

        const where: any = {};
        if (tenantId) where.tenantId = tenantId;
        if (status) where.status = status;
        if (keyword) {
            where.OR = [
                { title: { contains: keyword } },
                { description: { contains: keyword } },
            ];
        }

        const [total, rows] = await Promise.all([
            app.prisma.product.count({ where }),
            app.prisma.product.findMany({
                where,
                orderBy: { updatedAt: "desc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    tenantId: true,
                    title: true,
                    status: true,
                    basePrice: true,
                    pickupOnly: true,
                    minQty: true,
                    maxQty: true,
                    thumbnailUrl: true,
                    createdAt: true,
                    updatedAt: true,
                    tenant: { select: { slug: true, name: true } },
                },
            }),
        ]);

        return reply.send(
            jsonSafe({
                ok: true,
                total,
                page,
                limit,
                pageSize: limit,
                rows,
                items: rows, // 프론트 호환
            })
        );
    });

    // ✅ 상품 상세
    // GET /admin/products/:id
    app.get("/admin/products/:id", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const parsed = parseBigIntParam(req.params?.id);
        if (!parsed.ok) return reply.code(400).send({ ok: false, message: parsed.error });

        const product = await app.prisma.product.findUnique({
            where: { id: parsed.value },
            include: {
                tenant: { select: { slug: true, name: true } },
                options: { orderBy: { sortOrder: "asc" } },
            },
        });

        if (!product) return reply.code(404).send({ ok: false, message: "not found" });
        return reply.send({ ok: true, product: jsonSafe(product) });
    });

    // ✅ 상품 생성 (+ 옵션 다건)
    app.post("/admin/products", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const admin = (req.session as AdminSession).admin!;
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

        const createdBy = BigInt(admin.id);

        const payload = {
            tenantId: tenant.id,
            title,
            description: body.description == null ? null : String(body.description),
            status: String(body.status ?? "draft").trim() || "draft",
            thumbnailUrl: body.thumbnailUrl ? String(body.thumbnailUrl).trim() : null,
            imagesJson: body.imagesJson ? String(body.imagesJson).trim() : null,
            basePrice: toNumberSafe(body.basePrice, 0),
            pickupOnly: Boolean(body.pickupOnly ?? true),
            minQty: toNullableInt(body.minQty),
            maxQty: toNullableInt(body.maxQty),
            saleStartAt: body.saleStartAt ? new Date(String(body.saleStartAt)) : null,
            saleEndAt: body.saleEndAt ? new Date(String(body.saleEndAt)) : null,
            createdBy,
        };

        const options = Array.isArray(body.options) ? body.options : [];

        const created = await app.prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data: payload,
                select: { id: true, tenantId: true, title: true, status: true, createdAt: true },
            });

            const rows = options
                .map((o: any, idx: number) => ({
                    productId: product.id,
                    name: String(o.name ?? "").trim(),
                    sku: o.sku == null || String(o.sku).trim() === "" ? null : String(o.sku).trim(),
                    price: toNumberSafe(o.price, 0),
                    stockQty: toNullableInt(o.stockQty),
                    isActive: o.isActive == null ? true : Boolean(o.isActive),
                    sortOrder: Number.isFinite(Number(o.sortOrder)) ? Number(o.sortOrder) : idx,
                }))
                .filter((r: any) => r.name);

            if (rows.length > 0) {
                await tx.productOption.createMany({ data: rows });
            }

            return product;
        });

        return reply.send({ ok: true, product: jsonSafe(created) });
    });

    // ✅ 상품 수정 (DB 컬럼 기준 전체 반영 + 옵션 동기화)
    // PUT /admin/products/:id
    app.put("/admin/products/:id", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const parsed = parseBigIntParam(req.params?.id);
        if (!parsed.ok) return reply.code(400).send({ ok: false, message: parsed.error });
        const id = parsed.value;

        const body = (req.body ?? {}) as any;

        const title = String(body.title ?? "").trim();
        if (!title) return reply.code(400).send({ ok: false, message: "title required" });

        const status = String(body.status ?? "").trim() || "draft";

        const updateData: any = {
            title,
            description: body.description == null ? null : String(body.description),
            status,
            thumbnailUrl: body.thumbnailUrl ? String(body.thumbnailUrl).trim() : null,
            imagesJson: body.imagesJson ? String(body.imagesJson).trim() : null,
            basePrice: toNumberSafe(body.basePrice, 0),
            pickupOnly: Boolean(body.pickupOnly ?? true),
            minQty: toNullableInt(body.minQty),
            maxQty: toNullableInt(body.maxQty),
            saleStartAt: body.saleStartAt ? new Date(String(body.saleStartAt)) : null,
            saleEndAt: body.saleEndAt ? new Date(String(body.saleEndAt)) : null,
        };

        const options = Array.isArray(body.options) ? body.options : [];

        const updated = await app.prisma.$transaction(async (tx) => {
            // 존재 확인
            const exists = await tx.product.findUnique({ where: { id }, select: { id: true } });
            if (!exists) {
                // 트랜잭션 안에서 throw -> 404 처리
                const err: any = new Error("not found");
                err.statusCode = 404;
                throw err;
            }

            const product = await tx.product.update({
                where: { id },
                data: updateData,
                include: {
                    tenant: { select: { slug: true, name: true } },
                    options: { orderBy: { sortOrder: "asc" } },
                },
            });

            // ✅ 옵션 동기화(간단/안전): 기존 전부 삭제 후 재생성
            // (추후 “id 기반 upsert”가 필요하면 그때 확장)
            await tx.productOption.deleteMany({ where: { productId: id } });

            const rows = options
                .map((o: any, idx: number) => ({
                    productId: id,
                    name: String(o.name ?? "").trim(),
                    sku: o.sku == null || String(o.sku).trim() === "" ? null : String(o.sku).trim(),
                    price: toNumberSafe(o.price, 0),
                    stockQty: toNullableInt(o.stockQty),
                    isActive: o.isActive == null ? true : Boolean(o.isActive),
                    sortOrder: Number.isFinite(Number(o.sortOrder)) ? Number(o.sortOrder) : idx,
                }))
                .filter((r: any) => r.name);

            if (rows.length > 0) {
                await tx.productOption.createMany({ data: rows });
            }

            // 옵션 재조회해서 반환(정합)
            const reloaded = await tx.product.findUnique({
                where: { id },
                include: {
                    tenant: { select: { slug: true, name: true } },
                    options: { orderBy: { sortOrder: "asc" } },
                },
            });

            return reloaded ?? product;
        }).catch((e: any) => {
            if (e?.statusCode === 404 || e?.message === "not found") {
                return null;
            }
            throw e;
        });

        if (!updated) return reply.code(404).send({ ok: false, message: "not found" });
        return reply.send({ ok: true, product: jsonSafe(updated) });
    });
}