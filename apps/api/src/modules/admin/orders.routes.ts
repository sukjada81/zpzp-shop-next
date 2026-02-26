// apps/api/src/modules/admin/orders.routes.ts
import type { FastifyInstance } from "fastify";

type AdminSession = {
    admin?: {
        id: string;
        email?: string | null;
        name: string;
        isSuperAdmin: boolean;
    };
};

function requireSuperAdmin(req: { session?: AdminSession }, reply: any) {
    const admin = req.session?.admin;
    if (!admin?.isSuperAdmin) {
        reply.code(401);
        return reply.send({ ok: false, message: "unauthorized" });
    }
    return null;
}

export async function adminOrdersRoutes(app: FastifyInstance) {
    // GET /admin/orders?tenant=all|a|b&status=&q=&page=1&limit=20
    app.get("/admin/orders", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const tenantSlug = String(req.query?.tenant ?? "all").trim();
        const status = String(req.query?.status ?? "").trim();
        const q = String(req.query?.q ?? "").trim();
        const pageNum = Math.max(1, Number(req.query?.page ?? 1));
        const take = Math.min(50, Math.max(5, Number(req.query?.limit ?? 20)));
        const skip = (pageNum - 1) * take;

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

        const where: any = {};
        if (tenantIds) where.tenantId = { in: tenantIds };
        if (status) where.status = status;

        if (q) {
            where.OR = [
                { orderNo: { contains: q } },
                { buyerName: { contains: q } },
                { buyerPhone: { contains: q } },
            ];
        }

        const [rows, total] = await Promise.all([
            app.prisma.order.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take,
                select: {
                    id: true,
                    orderNo: true,
                    buyerName: true,
                    buyerPhone: true,
                    status: true,
                    paymentStatus: true,
                    subtotalAmount: true,
                    discountAmount: true,
                    pointUsedAmount: true,
                    totalAmount: true,
                    pickupAt: true,
                    createdAt: true,
                    tenant: { select: { slug: true, name: true } },
                },
            }),
            app.prisma.order.count({ where }),
        ]);

        return reply.send({
            ok: true,
            total,
            page: pageNum,
            limit: take,
            rows,
        });
    });

    // PATCH /admin/orders/:id/status  body: { status: "CONFIRMED" ... }
    app.patch("/admin/orders/:id/status", async (req: any, reply) => {
        const denied = requireSuperAdmin(req, reply);
        if (denied) return denied;

        const idRaw = String(req.params?.id ?? "");
        if (!idRaw) return reply.code(400).send({ ok: false, message: "id required" });

        const status = String(req.body?.status ?? "").trim();
        if (!status) return reply.code(400).send({ ok: false, message: "status required" });

        const updated = await app.prisma.order.update({
            where: { id: BigInt(idRaw) },
            data: { status },
            select: { id: true, orderNo: true, status: true, updatedAt: true },
        });

        return reply.send({ ok: true, updated });
    });
}