// apps/api/src/modules/admin/dashboard.routes.ts
import type { FastifyInstance } from "fastify";

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

export async function adminDashboardRoutes(app: FastifyInstance) {
    /**
     * GET /admin/:tenant/v1/dashboard
     * - tenant slug 기반
     * - 반드시 tenant_id 기준으로 집계/조회
     */
    app.get("/admin/:tenant/v1/dashboard", async (req, reply) => {
        const tenantSlug = String((req.params as any)?.tenant ?? "").trim();
        if (!tenantSlug) {
            return reply.code(400).send({ ok: false, message: "tenant is required" });
        }

        // prismaPlugin이 app에 prisma를 decorate했다고 가정
        // (프로젝트에서 이미 public routes에서 prisma 사용 중이라면 동일하게 접근 가능)
        const prisma = (app as any).prisma;
        if (!prisma) {
            return reply
                .code(500)
                .send({ ok: false, message: "prisma is not available on app" });
        }

        // 1) tenant resolve (slug -> id)
        const tenant = await prisma.tenant.findUnique({
            where: { slug: tenantSlug },
            select: { id: true, slug: true },
        });

        if (!tenant) {
            return reply.code(404).send({ ok: false, message: "tenant not found" });
        }

        const tenantId = tenant.id;

        // 2) 범위
        // ⚠️ 서버 TZ가 KST가 아니라면, 운영에서 TZ 통일(Asia/Seoul) 또는 TZ-aware 처리 권장
        const now = new Date();
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);

        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowEnd = endOfDay(tomorrow);

        // 3) 집계/조회 (모두 tenantId 필터)
        const [
            todayOrders,
            todaySalesAgg,
            unpaid,
            paid,
            pickupsUpcoming,
            pointUsedAgg,
            recentOrdersRaw,
        ] = await Promise.all([
            prisma.order.count({
                where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } },
            }),

            // 오늘 매출: 결제완료 기준을 "paymentStatus != unpaid"로 잡음
            prisma.order.aggregate({
                where: {
                    tenantId,
                    createdAt: { gte: todayStart, lte: todayEnd },
                    NOT: { paymentStatus: "unpaid" },
                },
                _sum: { totalAmount: true },
            }),

            prisma.order.count({
                where: { tenantId, paymentStatus: "unpaid" },
            }),

            prisma.order.count({
                where: { tenantId, NOT: { paymentStatus: "unpaid" } },
            }),

            prisma.order.count({
                where: { tenantId, pickupAt: { gte: now, lte: tomorrowEnd } },
            }),

            prisma.order.aggregate({
                where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } },
                _sum: { pointUsedAmount: true },
            }),

            prisma.order.findMany({
                where: { tenantId },
                orderBy: { createdAt: "desc" },
                take: 10,
                select: {
                    orderNo: true,
                    buyerName: true,
                    buyerPhone: true,
                    status: true,
                    totalAmount: true,
                    pickupAt: true,
                },
            }),
        ]);

        const todaySales = Number(todaySalesAgg._sum.totalAmount ?? 0);
        const pointUsed = Number(pointUsedAgg._sum.pointUsedAmount ?? 0);

        const recentOrders = recentOrdersRaw.map((o: any) => ({
            orderNo: o.orderNo,
            buyerName: o.buyerName,
            buyerPhone: o.buyerPhone,
            status: o.status,
            totalAmount: Number(o.totalAmount ?? 0),
            pickupAt: o.pickupAt
                ? o.pickupAt.toISOString().slice(0, 16).replace("T", " ")
                : null,
        }));

        // ✅ 프론트 AdminDashboardDto 형식에 맞춤 (목데이터 없음)
        return reply.send({
            tenant: tenant.slug,
            kpi: {
                todayOrders,
                todaySales,
                unpaid,
                paid,
                pickupsUpcoming,
                pointUsed,
            },
            recentOrders,
        });
    });
}