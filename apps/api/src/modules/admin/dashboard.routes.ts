// apps/api/src/modules/admin/dashboard.routes.ts
import type { FastifyInstance } from "fastify";
import {
    orderInfoWhereForAdminLinker,
    productUidsForAdminLinker,
    resolveAdminLinkerScope,
} from "./linker-scope.js";

function requireSuperAdmin(req: any, reply: any) {
    const admin = req.session?.admin;
    if (!admin?.isSuperAdmin) {
        reply.code(401);
        return reply.send({ ok: false, message: "unauthorized" });
    }
    return null;
}

function unixToIso(v: unknown) {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n) || n <= 0) return null;
    return new Date(n * 1000).toISOString();
}

export async function adminDashboardRoutes(app: FastifyInstance) {
    // GET /admin/dashboard?linker=all|{uid}
    app.get("/admin/dashboard", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const linkerParam = String(req.query?.linker ?? req.query?.tenant ?? "all").trim();
        const resolved = await resolveAdminLinkerScope(app, linkerParam);
        if (!resolved.ok) {
            return reply.code(400).send({ ok: false, message: resolved.message });
        }
        const scope = resolved.scope;

        const orderWhere = orderInfoWhereForAdminLinker(
            { platform_type: "DAD" },
            scope
        );

        const productIds = await productUidsForAdminLinker(app, scope);
        const productWhere =
            productIds === null
                ? { deleted_at: null }
                : productIds.length
                  ? { deleted_at: null, uid: { in: productIds } }
                  : { deleted_at: null, uid: { in: [-1] } };

        const [ordersCount, productsCount, salesAgg, recentOrders] = await Promise.all([
            app.prisma.mallRN_order_info.count({ where: orderWhere }),
            app.prisma.mallRN_goods.count({ where: productWhere }),
            app.prisma.mallRN_order_info.aggregate({
                where: orderWhere,
                _sum: { pay_total: true },
            }),
            app.prisma.mallRN_order_info.findMany({
                where: orderWhere,
                orderBy: [{ signdate: "desc" }, { uid: "desc" }],
                take: 20,
                select: {
                    uid: true,
                    order_num: true,
                    name: true,
                    cell: true,
                    pay_total: true,
                    pay_status: true,
                    signdate: true,
                    checkout_shop_slug: true,
                },
            }),
        ]);

        return reply.send({
            ok: true,
            linker: scope
                ? { uid: scope.linkerUid, shopSlug: scope.shopSlug, shopName: scope.shopName }
                : null,
            tenant: linkerParam || "all",
            kpi: {
                ordersCount,
                productsCount,
                totalSales: Number(salesAgg._sum.pay_total ?? 0),
                pointsSum: 0,
            },
            recentOrders: recentOrders.map((row) => ({
                id: String(row.uid),
                orderNo: String(row.order_num ?? ""),
                buyerName: String(row.name ?? ""),
                buyerPhone: String(row.cell ?? ""),
                status: String(row.pay_status ?? ""),
                paymentStatus: String(row.pay_status ?? ""),
                totalAmount: Number(row.pay_total ?? 0),
                createdAt: unixToIso(row.signdate) ?? "",
                tenant: {
                    slug: String(row.checkout_shop_slug || (scope?.shopSlug ?? "all")),
                    name: scope?.shopName || String(row.checkout_shop_slug || "전체"),
                },
            })),
        });
    });
}
