// apps/api/src/server.ts
import "dotenv/config";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import session from "@fastify/session";

import { prismaPlugin } from "./plugins/prisma.js";
import { tenantPlugin } from "./plugins/tenant.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { publicProductRoutes } from "./modules/public/products.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { adminAuthRoutes } from "./modules/admin/admin.auth.routes.js";

const app = Fastify({ logger: true });

await prismaPlugin(app);
await tenantPlugin(app);

// ✅ cookie/session (admin auth용)
app.register(cookie);
app.register(session, {
    secret: process.env.SESSION_SECRET || "CHANGE_ME_IN_PROD_32_CHARS_MIN________",
    cookie: {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: false, // prod에서는 true + https
    },
    saveUninitialized: false,
});

// tenant 없이도 되는 라우트
await healthRoutes(app);

// ✅ 통합 Admin API (tenant prefix 없음)
await adminAuthRoutes(app);
await adminRoutes(app);

// ✅ tenant prefix 아래 public API
app.register(
    async (tenantScoped) => {
        await publicProductRoutes(tenantScoped);
    },
    { prefix: "/:tenant" }
);

const port = Number(process.env.PORT ?? 4000);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
    app.log.error(err);
    process.exit(1);
});