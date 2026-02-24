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
    }>;
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
            // tenant not found -> single scope로 만들 수 없으니 all로 처리
            return { tenantWhere: {}, tenantInfo: { scope: "all" } };
        }
        return {
            tenantWhere: { tenantId: tenant.id },
            tenantInfo: { scope: "single", id: String(tenant.id), slug: tenant.slug, name: tenant.name },
        };
    }

    // TODO(권한): super_admin만 all 허용
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
                })),
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
    // GET /admin/v1/page.tsx?tenant=all|slug&page&pageSize&q&status
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
    // q: buyerName/orderNo/phone 부분검색
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
    // q: reason/type
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