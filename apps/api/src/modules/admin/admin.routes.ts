// apps/api/src/modules/admin/admin.routes.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Decimal } from "@prisma/client/runtime/library";

type TenantRow = {
    id: bigint;
    slug: string;
    name: string;
    status: string;
    primaryDomain: string | null;
    timezone: string;
    themeJson: string | null;
};

type TenantMini = { slug: string; name: string };

type ProductRow = {
    id: bigint;
    tenantId: bigint;
    title: string;
    status: string;
    thumbnailUrl: string | null;
    basePrice: Decimal;
    pickupOnly: boolean;
    minQty: number | null;
    maxQty: number | null;
    saleStartAt: Date | null;
    saleEndAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

type OrderRow = {
    id: bigint;
    tenantId: bigint;
    orderNo: string;
    buyerName: string;
    buyerPhone: string;
    status: string;
    paymentStatus: string;
    totalAmount: Decimal;
    pointUsedAmount: Decimal;
    pickupAt: Date | null;
    createdAt: Date;
};

type PointsRow = {
    id: bigint;
    tenantId: bigint;
    userId: bigint;
    type: string;
    amount: number;
    balanceAfter: number | null;
    reason: string | null;
    orderId: bigint | null;
    createdAt: Date;
};

type TenantsResponse = {
    ok: true;
    tenants: Array<{
        id: string;
        slug: string;
        name: string;
        status: string;
        primaryDomain: string | null;
        timezone: string;
        themeJson: any | null; // JSON으로 파싱된 값
    }>;
};

type TenantDetailResponse = {
    ok: true;
    tenant: {
        id: string;
        slug: string;
        name: string;
        status: string;
        primaryDomain: string | null;
        timezone: string;
        themeJson: any | null;
        createdAt: string;
        updatedAt: string;
    };
};

type TenantCreateBody = {
    slug: string;
    name: string;
    status?: string;
    primaryDomain?: string | null;
    timezone?: string;
    themeJson?: any | null; // object/string 모두 허용
};

type TenantUpdateBody = {
    slug: string;
    name: string;
    status?: string;
    primaryDomain?: string | null;
    timezone?: string;
    themeJson?: any | null; // object/string 모두 허용
};

type DashboardQuery = { tenant?: string };
type DashboardResponse = {
    ok: true;
    tenant: { scope: "all" } | { scope: "single"; id: string; slug: string; name: string };
    kpi: {
        todayOrders: number;
        todaySales: number;
        unpaid: number;
        paid: number;
        pickupsUpcoming: number;
        pointUsed: number;
    };
    recentOrders: Array<{
        tenant: TenantMini | null;
        orderNo: string;
        buyerName: string;
        buyerPhone: string;
        status: string;
        totalAmount: number;
        pickupAt: string | null;
        createdAt: string | null;
    }>;
};

type ListQueryBase = {
    tenant?: string; // all | slug
    page?: string;
    pageSize?: string;
    q?: string;
    status?: string;
};

type AdminListResponse<T> = {
    ok: true;
    tenant: { scope: "all" } | { scope: "single"; id: string; slug: string; name: string };
    page: number;
    pageSize: number;
    total: number;
    items: T[];
};

function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function endOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}
function toNumberDecimal(v: Decimal | null | undefined): number {
    if (v == null) return 0;
    return Number(v);
}
function clampInt(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}
function parsePage(q?: string) {
    const n = Number(q ?? "1");
    return clampInt(Number.isFinite(n) ? n : 1, 1, 10_000);
}
function parsePageSize(q?: string) {
    const n = Number(q ?? "20");
    return clampInt(Number.isFinite(n) ? n : 20, 5, 100);
}

function safeParseJson(raw: string | null): any | null {
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        // DB에 저장된 값이 JSON이 아닐 경우(혹시나) 그대로 string로 반환하지 않고 null 처리
        return null;
    }
}

function normalizeThemeJson(input: any): string | null {
    if (input == null) return null;
    if (typeof input === "string") {
        const s = input.trim();
        if (!s) return null;
        // string이 JSON인지 검증
        try {
            JSON.parse(s);
            return s;
        } catch {
            // JSON이 아니면 저장 거부(정책)
            throw new Error("THEME_JSON_INVALID");
        }
    }
    // object/array 등 -> stringify
    try {
        return JSON.stringify(input);
    } catch {
        throw new Error("THEME_JSON_INVALID");
    }
}

async function resolveTenantScope(
    prisma: any,
    qTenant: string
): Promise<{ tenantWhere: { tenantId?: bigint }; tenantInfo: DashboardResponse["tenant"] }> {
    const t = (qTenant || "all").trim();

    if (t && t !== "all") {
        const tenant: { id: bigint; slug: string; name: string } | null = await prisma.tenant.findUnique({
            where: { slug: t },
            select: { id: true, slug: true, name: true },
        });
        if (!tenant) {
            return { tenantWhere: {}, tenantInfo: { scope: "all" } };
        }
        return {
            tenantWhere: { tenantId: tenant.id },
            tenantInfo: { scope: "single", id: String(tenant.id), slug: tenant.slug, name: tenant.name },
        };
    }

    return { tenantWhere: {}, tenantInfo: { scope: "all" } };
}

async function buildTenantMap(prisma: any, tenantIds: bigint[]): Promise<Map<string, TenantMini>> {
    const map = new Map<string, TenantMini>();
    if (tenantIds.length === 0) return map;

    const rows: Array<{ id: bigint; slug: string; name: string }> = await prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, slug: true, name: true },
    });

    for (const r of rows) map.set(String(r.id), { slug: r.slug, name: r.name });
    return map;
}

function badRequest(reply: FastifyReply, message: string) {
    return reply.code(400).send({ ok: false, message });
}
function conflict(reply: FastifyReply, message: string) {
    return reply.code(409).send({ ok: false, message });
}
function notFound(reply: FastifyReply, message: string) {
    return reply.code(404).send({ ok: false, message });
}

export async function adminRoutes(app: FastifyInstance) {
    const prisma = (app as unknown as { prisma?: any }).prisma;
    if (!prisma) {
        app.log.error("prisma is not available on app (decorate missing)");
        throw new Error("prisma is not available on app");
    }

    // ---------------------------
    // GET /admin/v1/tenants
    // ---------------------------
    app.get(
        "/admin/v1/tenants",
        async (_req: FastifyRequest, reply: FastifyReply): Promise<TenantsResponse> => {
            const rows: TenantRow[] = await prisma.tenant.findMany({
                orderBy: { createdAt: "asc" },
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    status: true,
                    primaryDomain: true,
                    timezone: true,
                    themeJson: true,
                },
            });

            return reply.send({
                ok: true,
                tenants: rows.map((t) => ({
                    id: String(t.id),
                    slug: t.slug,
                    name: t.name,
                    status: t.status,
                    primaryDomain: t.primaryDomain,
                    timezone: t.timezone,
                    themeJson: safeParseJson(t.themeJson),
                })),
            });
        }
    );

    // ---------------------------
    // GET /admin/v1/tenants/:id (상세)
    // ---------------------------
    app.get(
        "/admin/v1/tenants/:id",
        async (
            req: FastifyRequest<{ Params: { id: string } }>,
            reply: FastifyReply
        ): Promise<TenantDetailResponse> => {
            const idStr = req.params.id;
            if (!idStr) return badRequest(reply, "TENANT_ID_REQUIRED") as any;

            let id: bigint;
            try {
                id = BigInt(idStr);
            } catch {
                return badRequest(reply, "TENANT_ID_INVALID") as any;
            }

            const t: (TenantRow & { createdAt: Date; updatedAt: Date }) | null = await prisma.tenant.findUnique({
                where: { id },
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    status: true,
                    primaryDomain: true,
                    timezone: true,
                    themeJson: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            if (!t) return notFound(reply, "TENANT_NOT_FOUND") as any;

            return reply.send({
                ok: true,
                tenant: {
                    id: String(t.id),
                    slug: t.slug,
                    name: t.name,
                    status: t.status,
                    primaryDomain: t.primaryDomain,
                    timezone: t.timezone,
                    themeJson: safeParseJson(t.themeJson),
                    createdAt: t.createdAt.toISOString(),
                    updatedAt: t.updatedAt.toISOString(),
                },
            });
        }
    );

    // ---------------------------
    // POST /admin/v1/tenants (생성)
    // ---------------------------
    app.post(
        "/admin/v1/tenants",
        async (
            req: FastifyRequest<{ Body: TenantCreateBody }>,
            reply: FastifyReply
        ) => {
            const body = req.body || ({} as any);

            const slug = String(body.slug ?? "").trim();
            const name = String(body.name ?? "").trim();
            const status = String(body.status ?? "active").trim();
            const primaryDomain = body.primaryDomain != null ? String(body.primaryDomain).trim() : null;
            const timezone = String(body.timezone ?? "Asia/Seoul").trim();

            if (!slug) return badRequest(reply, "SLUG_REQUIRED");
            if (!name) return badRequest(reply, "NAME_REQUIRED");

            // slug 중복 체크
            const dupSlug = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
            if (dupSlug) return conflict(reply, "SLUG_ALREADY_EXISTS");

            // primaryDomain unique (스키마에 unique)
            if (primaryDomain) {
                const dupDomain = await prisma.tenant.findUnique({
                    where: { primaryDomain },
                    select: { id: true },
                });
                if (dupDomain) return conflict(reply, "PRIMARY_DOMAIN_ALREADY_EXISTS");
            }

            let themeJsonStr: string | null = null;
            try {
                themeJsonStr = normalizeThemeJson(body.themeJson);
            } catch (e: any) {
                if (String(e?.message) === "THEME_JSON_INVALID") return badRequest(reply, "THEME_JSON_INVALID");
                return badRequest(reply, "THEME_JSON_INVALID");
            }

            const created = await prisma.tenant.create({
                data: {
                    slug,
                    name,
                    status,
                    primaryDomain: primaryDomain || null,
                    timezone,
                    themeJson: themeJsonStr,
                },
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    status: true,
                    primaryDomain: true,
                    timezone: true,
                    themeJson: true,
                },
            });

            return reply.send({
                ok: true,
                tenant: {
                    id: String(created.id),
                    slug: created.slug,
                    name: created.name,
                    status: created.status,
                    primaryDomain: created.primaryDomain,
                    timezone: created.timezone,
                    themeJson: safeParseJson(created.themeJson),
                },
            });
        }
    );

    // ---------------------------
    // PUT /admin/v1/tenants/:id (수정)
    // ---------------------------
    app.put(
        "/admin/v1/tenants/:id",
        async (
            req: FastifyRequest<{ Params: { id: string }; Body: TenantUpdateBody }>,
            reply: FastifyReply
        ) => {
            const idStr = req.params.id;
            if (!idStr) return badRequest(reply, "TENANT_ID_REQUIRED");

            let id: bigint;
            try {
                id = BigInt(idStr);
            } catch {
                return badRequest(reply, "TENANT_ID_INVALID");
            }

            const body = req.body || ({} as any);

            const slug = String(body.slug ?? "").trim();
            const name = String(body.name ?? "").trim();
            const status = String(body.status ?? "active").trim();
            const primaryDomain = body.primaryDomain != null ? String(body.primaryDomain).trim() : null;
            const timezone = String(body.timezone ?? "Asia/Seoul").trim();

            if (!slug) return badRequest(reply, "SLUG_REQUIRED");
            if (!name) return badRequest(reply, "NAME_REQUIRED");

            const current: { id: bigint; slug: string; primaryDomain: string | null } | null = await prisma.tenant.findUnique({
                where: { id },
                select: { id: true, slug: true, primaryDomain: true },
            });
            if (!current) return notFound(reply, "TENANT_NOT_FOUND");

            // slug 변경 시 중복 체크
            if (slug !== current.slug) {
                const dupSlug = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
                if (dupSlug) return conflict(reply, "SLUG_ALREADY_EXISTS");
            }

            // primaryDomain 변경 시 unique 체크
            if (primaryDomain !== (current.primaryDomain ?? null)) {
                if (primaryDomain) {
                    const dupDomain = await prisma.tenant.findUnique({
                        where: { primaryDomain },
                        select: { id: true },
                    });
                    if (dupDomain && String(dupDomain.id) !== String(id)) return conflict(reply, "PRIMARY_DOMAIN_ALREADY_EXISTS");
                }
            }

            let themeJsonStr: string | null | undefined = undefined;
            if ("themeJson" in body) {
                try {
                    themeJsonStr = normalizeThemeJson(body.themeJson);
                } catch (e: any) {
                    return badRequest(reply, "THEME_JSON_INVALID");
                }
            }

            const updated = await prisma.tenant.update({
                where: { id },
                data: {
                    slug,
                    name,
                    status,
                    primaryDomain: primaryDomain || null,
                    timezone,
                    ...(themeJsonStr === undefined ? {} : { themeJson: themeJsonStr }),
                },
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    status: true,
                    primaryDomain: true,
                    timezone: true,
                    themeJson: true,
                },
            });

            return reply.send({
                ok: true,
                tenant: {
                    id: String(updated.id),
                    slug: updated.slug,
                    name: updated.name,
                    status: updated.status,
                    primaryDomain: updated.primaryDomain,
                    timezone: updated.timezone,
                    themeJson: safeParseJson(updated.themeJson),
                },
            });
        }
    );

    // ---------------------------
    // GET /admin/v1/dashboard?tenant=all|{slug}
    // ---------------------------
    app.get(
        "/admin/v1/dashboard",
        async (
            req: FastifyRequest<{ Querystring: DashboardQuery }>,
            reply: FastifyReply
        ): Promise<DashboardResponse> => {
            const { tenantWhere, tenantInfo } = await resolveTenantScope(prisma, req.query.tenant ?? "all");

            const now = new Date();
            const todayStart = startOfDay(now);
            const todayEnd = endOfDay(now);

            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowEnd = endOfDay(tomorrow);

            const [
                todayOrders,
                todaySalesAgg,
                unpaid,
                paid,
                pickupsUpcoming,
                pointUsedAgg,
                recentOrdersRaw,
            ] = await Promise.all([
                prisma.order.count({ where: { ...tenantWhere, createdAt: { gte: todayStart, lte: todayEnd } } }),

                prisma.order.aggregate({
                    where: { ...tenantWhere, createdAt: { gte: todayStart, lte: todayEnd }, NOT: { paymentStatus: "unpaid" } },
                    _sum: { totalAmount: true },
                }) as Promise<{ _sum: { totalAmount: Decimal | null } }>,

                prisma.order.count({ where: { ...tenantWhere, paymentStatus: "unpaid" } }),

                prisma.order.count({ where: { ...tenantWhere, NOT: { paymentStatus: "unpaid" } } }),

                prisma.order.count({ where: { ...tenantWhere, pickupAt: { gte: now, lte: tomorrowEnd } } }),

                prisma.order.aggregate({
                    where: { ...tenantWhere, createdAt: { gte: todayStart, lte: todayEnd } },
                    _sum: { pointUsedAmount: true },
                }) as Promise<{ _sum: { pointUsedAmount: Decimal | null } }>,

                prisma.order.findMany({
                    where: { ...tenantWhere },
                    orderBy: { createdAt: "desc" },
                    take: 10,
                    select: {
                        tenantId: true,
                        orderNo: true,
                        buyerName: true,
                        buyerPhone: true,
                        status: true,
                        totalAmount: true,
                        pickupAt: true,
                        createdAt: true,
                    },
                }) as Promise<
                    Array<{
                        tenantId: bigint;
                        orderNo: string;
                        buyerName: string;
                        buyerPhone: string;
                        status: string;
                        totalAmount: Decimal;
                        pickupAt: Date | null;
                        createdAt: Date;
                    }>
                >,
            ]);

            const tenantIdSet = new Set<bigint>();
            for (const o of recentOrdersRaw) tenantIdSet.add(o.tenantId);
            const tenantMap = await buildTenantMap(prisma, Array.from(tenantIdSet));

            return reply.send({
                ok: true,
                tenant: tenantInfo,
                kpi: {
                    todayOrders,
                    todaySales: toNumberDecimal(todaySalesAgg._sum.totalAmount),
                    unpaid,
                    paid,
                    pickupsUpcoming,
                    pointUsed: toNumberDecimal(pointUsedAgg._sum.pointUsedAmount),
                },
                recentOrders: recentOrdersRaw.map((o) => ({
                    tenant: tenantMap.get(String(o.tenantId)) ?? null,
                    orderNo: o.orderNo,
                    buyerName: o.buyerName,
                    buyerPhone: o.buyerPhone,
                    status: o.status,
                    totalAmount: toNumberDecimal(o.totalAmount),
                    pickupAt: o.pickupAt ? o.pickupAt.toISOString().slice(0, 16).replace("T", " ") : null,
                    createdAt: o.createdAt ? o.createdAt.toISOString() : null,
                })),
            });
        }
    );

    // ---------------------------
    // GET /admin/v1/products?tenant=all|slug&page&pageSize&q&status
    // ---------------------------
    app.get(
        "/admin/v1/products",
        async (
            req: FastifyRequest<{ Querystring: ListQueryBase }>,
            reply: FastifyReply
        ): Promise<
            AdminListResponse<{
                tenant: TenantMini | null;
                id: string;
                title: string;
                status: string;
                basePrice: number;
                thumbnailUrl: string | null;
                pickupOnly: boolean;
                minQty: number | null;
                maxQty: number | null;
                saleStartAt: string | null;
                saleEndAt: string | null;
                updatedAt: string;
            }>
        > => {
            const page = parsePage(req.query.page);
            const pageSize = parsePageSize(req.query.pageSize);
            const q = (req.query.q ?? "").trim();
            const status = (req.query.status ?? "").trim();
            const { tenantWhere, tenantInfo } = await resolveTenantScope(prisma, req.query.tenant ?? "all");

            const where: any = { ...tenantWhere };
            if (status) where.status = status;
            if (q) where.title = { contains: q };

            const [total, rows] = await Promise.all([
                prisma.product.count({ where }),
                prisma.product.findMany({
                    where,
                    orderBy: { updatedAt: "desc" },
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                    select: {
                        id: true,
                        tenantId: true,
                        title: true,
                        status: true,
                        thumbnailUrl: true,
                        basePrice: true,
                        pickupOnly: true,
                        minQty: true,
                        maxQty: true,
                        saleStartAt: true,
                        saleEndAt: true,
                        updatedAt: true,
                    },
                }) as Promise<ProductRow[]>,
            ]);

            const tenantIdSet = new Set<bigint>();
            for (const r of rows) tenantIdSet.add(r.tenantId);
            const tenantMap = await buildTenantMap(prisma, Array.from(tenantIdSet));

            return reply.send({
                ok: true,
                tenant: tenantInfo,
                page,
                pageSize,
                total,
                items: rows.map((p) => ({
                    tenant: tenantMap.get(String(p.tenantId)) ?? null,
                    id: String(p.id),
                    title: p.title,
                    status: p.status,
                    basePrice: toNumberDecimal(p.basePrice),
                    thumbnailUrl: p.thumbnailUrl,
                    pickupOnly: !!p.pickupOnly,
                    minQty: p.minQty ?? null,
                    maxQty: p.maxQty ?? null,
                    saleStartAt: p.saleStartAt ? p.saleStartAt.toISOString() : null,
                    saleEndAt: p.saleEndAt ? p.saleEndAt.toISOString() : null,
                    updatedAt: p.updatedAt.toISOString(),
                })),
            });
        }
    );

    // ---------------------------
    // GET /admin/v1/orders?tenant=all|slug&page&pageSize&q&status
    // ---------------------------
    app.get(
        "/admin/v1/orders",
        async (
            req: FastifyRequest<{ Querystring: ListQueryBase }>,
            reply: FastifyReply
        ): Promise<
            AdminListResponse<{
                tenant: TenantMini | null;
                id: string;
                orderNo: string;
                buyerName: string;
                buyerPhone: string;
                status: string;
                paymentStatus: string;
                totalAmount: number;
                pointUsedAmount: number;
                pickupAt: string | null;
                createdAt: string;
            }>
        > => {
            const page = parsePage(req.query.page);
            const pageSize = parsePageSize(req.query.pageSize);
            const q = (req.query.q ?? "").trim();
            const status = (req.query.status ?? "").trim();
            const { tenantWhere, tenantInfo } = await resolveTenantScope(prisma, req.query.tenant ?? "all");

            const where: any = { ...tenantWhere };
            if (status) where.status = status;
            if (q) {
                where.OR = [
                    { orderNo: { contains: q } },
                    { buyerName: { contains: q } },
                    { buyerPhone: { contains: q } },
                ];
            }

            const [total, rows] = await Promise.all([
                prisma.order.count({ where }),
                prisma.order.findMany({
                    where,
                    orderBy: { createdAt: "desc" },
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                    select: {
                        id: true,
                        tenantId: true,
                        orderNo: true,
                        buyerName: true,
                        buyerPhone: true,
                        status: true,
                        paymentStatus: true,
                        totalAmount: true,
                        pointUsedAmount: true,
                        pickupAt: true,
                        createdAt: true,
                    },
                }) as Promise<OrderRow[]>,
            ]);

            const tenantIdSet = new Set<bigint>();
            for (const r of rows) tenantIdSet.add(r.tenantId);
            const tenantMap = await buildTenantMap(prisma, Array.from(tenantIdSet));

            return reply.send({
                ok: true,
                tenant: tenantInfo,
                page,
                pageSize,
                total,
                items: rows.map((o) => ({
                    tenant: tenantMap.get(String(o.tenantId)) ?? null,
                    id: String(o.id),
                    orderNo: o.orderNo,
                    buyerName: o.buyerName,
                    buyerPhone: o.buyerPhone,
                    status: o.status,
                    paymentStatus: o.paymentStatus,
                    totalAmount: toNumberDecimal(o.totalAmount),
                    pointUsedAmount: toNumberDecimal(o.pointUsedAmount),
                    pickupAt: o.pickupAt ? o.pickupAt.toISOString().slice(0, 16).replace("T", " ") : null,
                    createdAt: o.createdAt.toISOString(),
                })),
            });
        }
    );

    // ---------------------------
    // GET /admin/v1/points?tenant=all|slug&page&pageSize&q&status
    // ---------------------------
    app.get(
        "/admin/v1/points",
        async (
            req: FastifyRequest<{ Querystring: ListQueryBase }>,
            reply: FastifyReply
        ): Promise<
            AdminListResponse<{
                tenant: TenantMini | null;
                id: string;
                userId: string;
                type: string;
                amount: number;
                balanceAfter: number | null;
                reason: string | null;
                orderId: string | null;
                createdAt: string;
            }>
        > => {
            const page = parsePage(req.query.page);
            const pageSize = parsePageSize(req.query.pageSize);
            const q = (req.query.q ?? "").trim();
            const type = (req.query.status ?? "").trim(); // points는 status 대신 type 필터로 재사용
            const { tenantWhere, tenantInfo } = await resolveTenantScope(prisma, req.query.tenant ?? "all");

            const where: any = { ...tenantWhere };
            if (type) where.type = type;
            if (q) {
                where.OR = [{ reason: { contains: q } }, { type: { contains: q } }];
            }

            const [total, rows] = await Promise.all([
                prisma.pointsLedger.count({ where }),
                prisma.pointsLedger.findMany({
                    where,
                    orderBy: { createdAt: "desc" },
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                    select: {
                        id: true,
                        tenantId: true,
                        userId: true,
                        type: true,
                        amount: true,
                        balanceAfter: true,
                        reason: true,
                        orderId: true,
                        createdAt: true,
                    },
                }) as Promise<PointsRow[]>,
            ]);

            const tenantIdSet = new Set<bigint>();
            for (const r of rows) tenantIdSet.add(r.tenantId);
            const tenantMap = await buildTenantMap(prisma, Array.from(tenantIdSet));

            return reply.send({
                ok: true,
                tenant: tenantInfo,
                page,
                pageSize,
                total,
                items: rows.map((p) => ({
                    tenant: tenantMap.get(String(p.tenantId)) ?? null,
                    id: String(p.id),
                    userId: String(p.userId),
                    type: p.type,
                    amount: p.amount,
                    balanceAfter: p.balanceAfter ?? null,
                    reason: p.reason ?? null,
                    orderId: p.orderId ? String(p.orderId) : null,
                    createdAt: p.createdAt.toISOString(),
                })),
            });
        }
    );
}