// apps/api/src/plugins/tenant.ts
import type { FastifyInstance, FastifyRequest } from "fastify";

declare module "fastify" {
    interface FastifyRequest {
        tenantSlug?: string | null;
        tenantId?: bigint | null;
    }
}

function normalizeTenant(raw: unknown) {
    const t = String(raw ?? "").trim().toLowerCase();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

function getHostOnly(req: FastifyRequest) {
    const host = (req.headers["host"] ?? "").toString();
    return host.split(":")[0]; // remove port
}

function isIp(host: string) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

export async function tenantPlugin(app: FastifyInstance) {
    app.addHook("preValidation", async (request, reply) => {
        const url = request.raw.url ?? request.url ?? "";

        // ✅ tenant 없이 동작해야 하는 라우트는 스킵
        if (url.startsWith("/admin") || url.startsWith("/health")) {
            request.tenantSlug = null;
            request.tenantId = null;
            return;
        }

        const mode = process.env.TENANT_RESOLVE_MODE ?? "host-first";

        let slug = "";

        // ✅ 1) host 기반 (운영: subdomain)
        if (mode === "host-first" || mode === "host") {
            const hostOnly = getHostOnly(request);

            // localhost / IP 접속이면 subdomain tenant 해석 불가
            if (hostOnly && hostOnly !== "localhost" && !isIp(hostOnly)) {
                const parts = hostOnly.split(".");
                // ex) a.example.com => a
                if (parts.length >= 3) slug = normalizeTenant(parts[0]);
            }
        }

        // ✅ 2) path param fallback: /:tenant/...
        if (!slug) {
            const params = (request.params ?? {}) as Record<string, unknown>;
            slug = normalizeTenant(params["tenant"]);
        }

        if (!slug) {
            request.tenantSlug = null;
            request.tenantId = null;
            // requireTenant에서 TENANT_NOT_RESOLVED 처리
            return;
        }

        // ✅ DB에서 tenantId 조회 (Prisma 사용)
        try {
            const t = await app.prisma.tenant.findUnique({
                where: { slug },
                select: { id: true, slug: true },
            });

            if (!t) {
                request.tenantSlug = null;
                request.tenantId = null;
                return;
            }

            request.tenantSlug = t.slug; // 정규화된 slug
            request.tenantId = t.id;
        } catch (e) {
            // DB 문제면 500으로
            request.tenantSlug = null;
            request.tenantId = null;
            reply.code(500).send({ ok: false, error: "TENANT_RESOLVE_FAILED" });
        }
    });
}