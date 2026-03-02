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

/**
 * Prefer x-forwarded-host (behind proxy/tunnel), fallback to host.
 * Return host without port.
 */
function getHostOnly(req: FastifyRequest) {
    const xfHost = (req.headers["x-forwarded-host"] ?? "").toString().trim();
    const host = (req.headers["host"] ?? "").toString().trim();

    // x-forwarded-host can be a comma-separated list: client, proxy1, proxy2...
    const picked = (xfHost || host).split(",")[0]?.trim() ?? "";
    return picked.split(":")[0]; // remove port
}

function isIp(host: string) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

/**
 * Tunnels / dev share domains where host-first tenant parsing is wrong.
 * Add more if you use other tunnel services.
 */
function isTunnelDomain(hostOnly: string) {
    const h = hostOnly.toLowerCase();

    const blockedSuffixes = [
        // ngrok
        "ngrok-free.dev",
        "ngrok-free.app",
        "ngrok.app",
        "ngrok.io",
        // cloudflare tunnel
        "trycloudflare.com",
        // localtunnel
        "loca.lt",
        "localtunnel.me",
    ];

    return blockedSuffixes.some((suffix) => h === suffix || h.endsWith(`.${suffix}`));
}

/**
 * Extract subdomain slug from host based on TENANT_BASE_DOMAIN if set.
 * Example:
 *  - TENANT_BASE_DOMAIN=example.com
 *  - a.example.com -> "a"
 *
 * Without TENANT_BASE_DOMAIN, we use a conservative heuristic:
 *  - only parse if host has at least 3 labels (a.b.c)
 *  - and not tunnel/local/ip/localhost
 */
function resolveSlugFromHost(hostOnly: string) {
    const h = (hostOnly || "").toLowerCase().trim();
    if (!h) return "";

    // localhost / ip / tunnel domains should not be interpreted as tenant subdomain
    if (h === "localhost" || isIp(h) || isTunnelDomain(h)) return "";

    const baseDomain = (process.env.TENANT_BASE_DOMAIN ?? "").toLowerCase().trim();

    // If base domain is configured, only parse when host ends with it
    if (baseDomain) {
        if (h === baseDomain) return "";
        if (!h.endsWith(`.${baseDomain}`)) return "";

        // Take the left-most label before baseDomain
        const rest = h.slice(0, -(baseDomain.length + 1)); // remove ".baseDomain"
        const firstLabel = rest.split(".")[0] ?? "";
        return normalizeTenant(firstLabel);
    }

    // Fallback heuristic (no base domain configured)
    const parts = h.split(".");
    // ex) a.example.com => ["a","example","com"] (>=3)
    if (parts.length >= 3) return normalizeTenant(parts[0]);

    return "";
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
            slug = resolveSlugFromHost(hostOnly);
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