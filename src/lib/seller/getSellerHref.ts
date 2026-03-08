// src/lib/seller/getSellerHref.ts
export function getSellerHref(tenant: string, path = "") {
    const normalized = !path
        ? ""
        : path.startsWith("/")
            ? path
            : `/${path}`;

    return `/${tenant}${normalized}`;
}