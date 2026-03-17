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

function isNonTenantServiceHost(hostOnly: string) {
    const h = (hostOnly || "").toLowerCase().trim();

    if (!h) return false;

    return (
        h === "localhost" ||
        h === "127.0.0.1" ||
        h === "auth.discountallday.kr" ||
        h === "select-tenant.discountallday.kr" ||
        h === "seller.discountallday.kr"
    );
}

function resolveSlugFromHost(hostOnly: string) {
    const h = (hostOnly || "").toLowerCase().trim();
    if (!h) return "";

    if (h === "localhost" || isIp(h) || isTunnelDomain(h) || isNonTenantServiceHost(h)) {
        return "";
    }

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

function shouldBypassTenant(url: string, hostOnly: string) {
    const path = String(url || "");

    if (
        path.startsWith("/admin") ||
        path.startsWith("/health") ||
        path.startsWith("/v1/auth")
    ) {
        return true;
    }

    if (
        hostOnly === "auth.discountallday.kr" ||
        hostOnly === "select-tenant.discountallday.kr"
    ) {
        return true;
    }

    return false;
}

export async function tenantPlugin(app: FastifyInstance) {
    app.addHook("preValidation", async (request, reply) => {
        const url = request.raw.url ?? request.url ?? "";
        const hostOnly = getHostOnly(request);

        if (shouldBypassTenant(url, hostOnly)) {
            request.tenantSlug = null;
            request.tenantId = null;

            console.log("TENANT_BYPASS", {
                url,
                hostOnly,
                reason: "auth/admin/health/service-host",
            });

            return;
        }

        const mode = process.env.TENANT_RESOLVE_MODE ?? "host-first";

        let slug = "";

        // 0) x-tenant-slug 헤더 우선 허용 (Next proxy -> API 호출용)
        slug = normalizeTenant(request.headers["x-tenant-slug"]);

        if (slug) {
            console.log("TENANT_FROM_HEADER", {
                url,
                hostOnly,
                slug,
            });
        }

        // 1) host 기반
        if (!slug && (mode === "host-first" || mode === "host")) {
            slug = resolveSlugFromHost(hostOnly);

            console.log("TENANT_FROM_HOST", {
                url,
                hostOnly,
                slug,
            });
        }

        // 2) path param fallback
        if (!slug) {
            const params = (request.params ?? {}) as Record<string, unknown>;
            slug = normalizeTenant(params["tenant"]);

            if (slug) {
                console.log("TENANT_FROM_PARAMS", {
                    url,
                    hostOnly,
                    slug,
                });
            }
        }

        if (!slug) {
            request.tenantSlug = null;
            request.tenantId = null;

            console.log("TENANT_NOT_FOUND_SKIP", {
                url,
                hostOnly,
                mode,
            });

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

                console.log("TENANT_DB_NOT_FOUND", {
                    url,
                    hostOnly,
                    slug,
                });

                return;
            }

            request.tenantSlug = t.slug;
            request.tenantId = t.id;

            console.log("TENANT_RESOLVED", {
                url,
                hostOnly,
                slug: t.slug,
                tenantId: String(t.id),
            });
        } catch (err) {
            request.tenantSlug = null;
            request.tenantId = null;

            console.error("TENANT_RESOLVE_FAILED", {
                url,
                hostOnly,
                slug,
                error: err instanceof Error ? err.message : String(err),
            });

            reply.code(500).send({ ok: false, error: "TENANT_RESOLVE_FAILED" });
        }
    });
}