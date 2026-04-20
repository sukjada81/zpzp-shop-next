// apps/api/src/server.ts
import "dotenv/config";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "path";

import { tenantPlugin } from "./plugins/tenant.js";
import { sessionPlugin } from "./plugins/session.js";

import { healthRoutes } from "./modules/health/health.routes.js";
import { publicProductRoutes } from "./modules/public/products.routes.js";
import { publicOrderRoutes } from "./modules/public/orders.routes.js";
import { publicTenantRoutes } from "./modules/public/tenants.routes.js";

import { adminAuthRoutes } from "./modules/admin/admin.auth.routes.js";
import { adminDashboardRoutes } from "./modules/admin/dashboard.routes.js";
import { adminOrdersRoutes } from "./modules/admin/orders.routes.js";
import { adminProductsRoutes } from "./modules/admin/products.routes.js";
import { adminUploadsRoutes } from "./modules/admin/uploads.routes.js";
import { sellerMembersRoutes } from "./modules/seller/members.routes.js";
import { sellerOrderRoutes } from "./modules/seller/orders.routes.js";
import { sellerDashboardRoutes } from "./modules/seller/dashboard.routes.js";
import { sellerSalesRoutes } from "./modules/seller/sales.routes.js";
import { publicAuthRoutes } from "./modules/public/auth.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";

const app = Fastify({
    logger: true,
    trustProxy: true,
});

await app.register(multipart, {
    limits: {
        fileSize: 30 * 1024 * 1024,
    },
});

await app.register(fastifyStatic, {
    root: path.join(process.cwd(), "uploads"),
    prefix: "/uploads/",
});

const usePrisma = process.env.USE_PRISMA !== "0";

if (usePrisma) {
    const mod = await import("./plugins/prisma.js");
    await mod.prismaPlugin(app);
} else {
    app.log.warn("USE_PRISMA=0 (Prisma disabled)");
}

await tenantPlugin(app);
await sessionPlugin(app);

await healthRoutes(app);

await adminAuthRoutes(app);
await adminDashboardRoutes(app);
await adminOrdersRoutes(app);
await adminProductsRoutes(app);
await adminUploadsRoutes(app);

await adminRoutes(app);
await publicAuthRoutes(app);

await sellerDashboardRoutes(app);
await sellerSalesRoutes(app);
await sellerMembersRoutes(app);
await sellerOrderRoutes(app);

app.register(
    async (tenantScoped) => {
        await publicTenantRoutes(tenantScoped);
        await publicProductRoutes(tenantScoped);
        await publicOrderRoutes(tenantScoped);
    },
    { prefix: "/:tenant" }
);

const port = Number(process.env.PORT ?? 4000);

app
    .listen({ port, host: "0.0.0.0" })
    .then((address) => {
        app.log.info(`API listening on ${address}`);
    })
    .catch((err) => {
        app.log.error(err);
        process.exit(1);
    });