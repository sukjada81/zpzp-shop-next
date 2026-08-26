// src/lib/admin/linkerScope.ts
export const ADMIN_LINKER_COOKIE = "admin_linker_scope";

export function normalizeLinkerScopeValue(raw: unknown): string {
    const v = String(raw ?? "all").trim();
    if (!v || v === "all") return "all";
    if (/^\d+$/.test(v)) return v;
    return "all";
}

export function readAdminLinkerFromCookie(cookieHeader: string | null | undefined): string {
    const raw = String(cookieHeader ?? "");
    const match = raw.match(/(?:^|;\s*)admin_linker_scope=([^;]*)/);
    if (!match) return "all";
    try {
        return normalizeLinkerScopeValue(decodeURIComponent(match[1]));
    } catch {
        return normalizeLinkerScopeValue(match[1]);
    }
}

export function linkerScopeLabel(linker: string, options: Array<{ uid: number; shopName: string; shopSlug: string }>) {
    if (linker === "all") return "전체 링커";
    const hit = options.find((row) => String(row.uid) === linker);
    if (!hit) return `링커 #${linker}`;
    return hit.shopName || hit.shopSlug || `링커 #${linker}`;
}
