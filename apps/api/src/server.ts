// apps/api/src/server.ts
import "dotenv/config";
import Fastify from "fastify";
import { tenantPlugin } from "./plugins/tenant.js";
import { sessionPlugin } from "./plugins/session.js";

import { healthRoutes } from "./modules/health/health.routes.js";
import { publicProductRoutes } from "./modules/public/products.routes.js";

import { adminAuthRoutes } from "./modules/admin/admin.auth.routes.js";
import { adminDashboardRoutes } from "./modules/admin/dashboard.routes.js";
import { adminOrdersRoutes } from "./modules/admin/orders.routes.js";
import { adminProductsRoutes } from "./modules/admin/products.routes.js";

const app = Fastify({ logger: true });

/**
 * Prisma 사용 여부
 * - USE_PRISMA=0 이면 prismaPlugin 로딩/실행 안 함
 * - 그 외(미설정 포함)는 prismaPlugin 사용
 */
const usePrisma = process.env.USE_PRISMA !== "0";

if (usePrisma) {
    // ✅ Prisma를 정적 import하면 로드 단계에서 터질 수 있어 동적 import로 처리
    const mod = await import("./plugins/prisma.js");
    // mod.prismaPlugin(app) 형태로 호출 (기존 코드 스타일 유지)
    await mod.prismaPlugin(app);
} else {
    app.log.warn("USE_PRISMA=0 (Prisma disabled) - prismaPlugin is not loaded.");
}

await tenantPlugin(app);
await sessionPlugin(app);

// tenant 없이도 되는 라우트
await healthRoutes(app);

// ✅ 통합 admin (tenant prefix 없음) — 각 라우트는 "딱 1번만" 등록해야 함
await adminAuthRoutes(app);
await adminDashboardRoutes(app);
await adminOrdersRoutes(app);
await adminProductsRoutes(app);

// ✅ tenant prefix 아래 public API
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