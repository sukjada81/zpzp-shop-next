import "dotenv/config";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "path";

import { tenantPlugin } from "./plugins/tenant.js";
import { sessionPlugin } from "./plugins/session.js";

import { healthRoutes } from "./modules/health/health.routes.js";
import { publicProductRoutes } from "./modules/public/products.routes.js";

import { adminAuthRoutes } from "./modules/admin/admin.auth.routes.js";
import { adminDashboardRoutes } from "./modules/admin/dashboard.routes.js";
import { adminOrdersRoutes } from "./modules/admin/orders.routes.js";
import { adminProductsRoutes } from "./modules/admin/products.routes.js";
import { adminUploadsRoutes } from "./modules/admin/uploads.routes.js";

import { adminRoutes } from "./modules/admin/admin.routes.js";

const app = Fastify({ logger: true });

/**
 * multipart (파일 업로드)
 */
await app.register(multipart);

/**
 * 정적 파일 서빙
 * /uploads/* → 실제 서버 uploads 폴더
 */
await app.register(fastifyStatic, {
    root: path.join(process.cwd(), "uploads"),
    prefix: "/uploads/",
});

/**
 * Prisma 사용 여부
 */
const usePrisma = process.env.USE_PRISMA !== "0";

if (usePrisma) {
    const mod = await import("./plugins/prisma.js");
    await mod.prismaPlugin(app);
} else {
    app.log.warn("USE_PRISMA=0 (Prisma disabled)");
}

await tenantPlugin(app);
await sessionPlugin(app);

/**
 * 공통 라우트
 */
await healthRoutes(app);

/**
 * Admin 라우트
 */
await adminAuthRoutes(app);
await adminDashboardRoutes(app);
await adminOrdersRoutes(app);
await adminProductsRoutes(app);
await adminUploadsRoutes(app);

/**
 * /admin/v1/*
 */
await adminRoutes(app);

/**
 * tenant public api
 */
app.register(
    async (tenantScoped) => {
        await publicProductRoutes(tenantScoped);
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