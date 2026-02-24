import type { FastifyInstance, FastifyRequest } from "fastify";

declare module "fastify" {
    interface FastifyRequest {
        tenantId?: bigint;
        tenantSlug?: string;
    }
}

function extractSubdomain(host: string) {
    const h = host.split(":")[0].toLowerCase();
    if (h === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return null;
    const parts = h.split(".");
    if (parts.length < 3) return null;
    return parts[0]; // a.example.com -> a
}

function extractSlugFromPath(url: string) {
    const path = url.split("?")[0];
    const seg = path.split("/").filter(Boolean)[0];
    return seg ? seg.toLowerCase() : null;
}

export async function tenantPlugin(app: FastifyInstance) {
    const mode = process.env.TENANT_RESOLVE_MODE ?? "host-first";

    app.addHook("preHandler", async (req: FastifyRequest) => {
        const host = (req.headers["host"] ?? "").toString();
        const url = req.url;

        // ✅ 1) 라우트 prefix "/:tenant"에서 tenant 파라미터 우선 사용
        const params: any = req.params;
        const fromParam = typeof params?.tenant === "string" ? params.tenant.toLowerCase() : null;

        let slug: string | null = fromParam;

        // ✅ 2) fallback: host/path 방식(나중에 운영/특수 라우트용)
        if (!slug) {
            if (mode === "host-first") slug = extractSubdomain(host) ?? extractSlugFromPath(url);
            else if (mode === "path-only") slug = extractSlugFromPath(url);
            else slug = extractSubdomain(host) ?? extractSlugFromPath(url);
        }

        if (!slug) return;

        const tenant = await app.prisma.tenant.findUnique({ where: { slug } });
        if (!tenant) return;

        req.tenantId = tenant.id;
        req.tenantSlug = tenant.slug;
    });
}