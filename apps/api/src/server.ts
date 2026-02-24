import "dotenv/config";
import Fastify from "fastify";
import { prismaPlugin } from "./plugins/prisma.js";
import { tenantPlugin } from "./plugins/tenant.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { publicProductRoutes } from "./modules/public/products.routes.js";

const app = Fastify({ logger: true });

await prismaPlugin(app);
await tenantPlugin(app);

// tenant 없이도 되는 라우트
await healthRoutes(app);

// ✅ tenant prefix 아래에 public API들을 등록
// 이제 /a/v1/public/products 형태가 정상 라우트가 됨
app.register(async (tenantScoped) => {
    await publicProductRoutes(tenantScoped);
}, { prefix: "/:tenant" });

const port = Number(process.env.PORT ?? 4000);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
    app.log.error(err);
    process.exit(1);
});