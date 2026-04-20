// src/lib/tenant/getTenant.ts

/**
 * tenant slug 정규화
 */
export function normalizeTenant(raw: string) {
    const t = (raw || "").trim().toLowerCase();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

/**
 * pathname에서 tenant 추출 (path mode: /:tenant/home)
 * ex) "/a/home" -> "a"
 */
export function tenantFromPathname(pathname: string) {
    const seg =
        (pathname || "")
            .split("?")[0]
            .split("#")[0]
            .split("/")
            .filter(Boolean)[0] || "";

    return normalizeTenant(seg);
}

/**
 * Next App Router params에서 tenant 추출
 */
export function tenantFromParams(params: any) {
    const t = params?.tenant;
    if (typeof t === "string") return normalizeTenant(t);
    return "";
}