const RESERVED_STORE_SUBDOMAINS = new Set([
    "www",
    "admin",
    "auth",
    "api",
    "select-tenant",
    "seller",
    "hq",
]);

export function storeSlugFromHost(host: string | undefined): string {
    const hostOnly = String(host ?? "")
        .split(",")[0]
        .split(":")[0]
        .trim()
        .toLowerCase();
    if (!hostOnly || hostOnly === "localhost") return "";
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly)) return "";

    const parts = hostOnly.split(".");
    if (parts.length < 3) return "";

    const sub = parts[0];
    if (!sub || RESERVED_STORE_SUBDOMAINS.has(sub)) return "";
    return sub;
}

/** 결제 시점 링커 스토어 slug — 진열/귀속과 분리. 본사몰(zpzp.kr)이면 ''. */
export function getCheckoutShopSlug(req: {
    headers?: Record<string, string | string[] | undefined>;
    cookies?: Record<string, string | undefined>;
}): string {
    const explicit = String(req.headers?.["x-zpzp-store-slug"] ?? "")
        .trim()
        .toLowerCase();
    if (explicit && !RESERVED_STORE_SUBDOMAINS.has(explicit)) return explicit;

    const forwarded = req.headers?.["x-forwarded-host"];
    const hostHeader = req.headers?.host;
    const host = Array.isArray(forwarded) ? forwarded[0] : forwarded ?? (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader);
    const fromHost = storeSlugFromHost(host);
    if (fromHost) return fromHost;

    const ref = String(req.cookies?.zpzp_ref ?? "")
        .trim()
        .toLowerCase();
    if (ref && !RESERVED_STORE_SUBDOMAINS.has(ref)) return ref;
    return "";
}
