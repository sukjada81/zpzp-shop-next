// apps/api/src/modules/admin/dashboard.routes.ts
import type { FastifyInstance } from "fastify";

function requireSuperAdmin(req: any, reply: any) {
    const admin = req.session?.admin;
    if (!admin?.isSuperAdmin) {
        reply.code(401);
        return reply.send({ ok: false, message: "unauthorized" });
    }
    return null;
}

export async function adminDashboardRoutes(app: FastifyInstance) {
    // GET /admin/dashboard?tenant=all|a|b
    app.get("/admin/dashboard", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const tenantSlug = String(req.query?.tenant ?? "all").trim();

        // tenantIds 결정
        let tenantIds: bigint[] | null = null;

        if (tenantSlug !== "all") {
            const t = await app.prisma.tenant.findUnique({
                where: { slug: tenantSlug },
                select: { id: true },
            });
            if (!t) return reply.code(400).send({ ok: false, message: "invalid tenant" });
            tenantIds = [t.id];
        }

        const orderWhere = tenantIds ? { tenantId: { in: tenantIds } } : {};
        const pointsWhere = tenantIds ? { tenantId: { in: tenantIds } } : {};
        const productWhere = tenantIds ? { tenantId: { in: tenantIds } } : {};

        const [ordersCount, productsCount, salesAgg, pointsAgg, recentOrders] = await Promise.all([
            app.prisma.order.count({ where: orderWhere }),
            app.prisma.product.count({ where: productWhere }),
            app.prisma.order.aggregate({
                where: orderWhere,
                _sum: { totalAmount: true },
            }),
            app.prisma.pointsLedger.aggregate({
                where: pointsWhere,
                _sum: { amount: true },
            }),
            app.prisma.order.findMany({
                where: orderWhere,
                orderBy: { createdAt: "desc" },
                take: 20,
                select: {
                    id: true,
                    orderNo: true,
                    buyerName: true,
                    buyerPhone: true,
                    status: true,
                    paymentStatus: true,
                    totalAmount: true,
                    createdAt: true,
                    tenant: { select: { slug: true, name: true } },
                },
            }),
        ]);

        return reply.send({
            ok: true,
            tenant: tenantSlug,
            kpi: {
                ordersCount,
                productsCount,
                totalSales: salesAgg._sum.totalAmount ?? 0,
                pointsSum: pointsAgg._sum.amount ?? 0,
            },
            recentOrders,
        });
    });
}