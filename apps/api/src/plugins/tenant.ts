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
    const xfHost = (req.headers["x-forwarded-host"] ?? "").toString().trim();
    const host = (req.headers["host"] ?? "").toString().trim();
    const picked = (xfHost || host).split(",")[0]?.trim() ?? "";
    return picked.split(":")[0];
}

function isIp(host: string) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isTunnelDomain(hostOnly: string) {
    const h = hostOnly.toLowerCase();

    const blockedSuffixes = [
        "ngrok-free.dev",
        "ngrok-free.app",
        "ngrok.app",
        "ngrok.io",
        "trycloudflare.com",
        "loca.lt",
        "localtunnel.me",
    ];

    return blockedSuffixes.some((suffix) => h === suffix || h.endsWith(`.${suffix}`));
}

function resolveSlugFromHost(hostOnly: string) {
    const h = (hostOnly || "").toLowerCase().trim();
    if (!h) return "";

    if (h === "localhost" || isIp(h) || isTunnelDomain(h)) return "";

    const baseDomain = (process.env.TENANT_BASE_DOMAIN ?? "").toLowerCase().trim();

    if (baseDomain) {
        if (h === baseDomain) return "";
        if (!h.endsWith(`.${baseDomain}`)) return "";

        const rest = h.slice(0, -(baseDomain.length + 1));
        const firstLabel = rest.split(".")[0] ?? "";
        return normalizeTenant(firstLabel);
    }

    const parts = h.split(".");
    if (parts.length >= 3) return normalizeTenant(parts[0]);

    return "";
}

export async function tenantPlugin(app: FastifyInstance) {
    app.addHook("preValidation", async (request, reply) => {
        const url = request.raw.url ?? request.url ?? "";

        if (
            url.startsWith("/admin") ||
            url.startsWith("/health") ||
            url.startsWith("/v1/auth")
        ) {
            request.tenantSlug = null;
            request.tenantId = null;
            return;
        }

        const mode = process.env.TENANT_RESOLVE_MODE ?? "host-first";

        let slug = "";

        // 0) x-tenant-slug 헤더 우선 허용 (Next proxy -> API 호출용)
        slug = normalizeTenant(request.headers["x-tenant-slug"]);

        // 1) host 기반
        if (!slug && (mode === "host-first" || mode === "host")) {
            const hostOnly = getHostOnly(request);
            slug = resolveSlugFromHost(hostOnly);
        }

        // 2) path param fallback
        if (!slug) {
            const params = (request.params ?? {}) as Record<string, unknown>;
            slug = normalizeTenant(params["tenant"]);
        }

        if (!slug) {
            request.tenantSlug = null;
            request.tenantId = null;
            return;
        }

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

            request.tenantSlug = t.slug;
            request.tenantId = t.id;
        } catch {
            request.tenantSlug = null;
            request.tenantId = null;
            reply.code(500).send({ ok: false, error: "TENANT_RESOLVE_FAILED" });
        }
    });
}