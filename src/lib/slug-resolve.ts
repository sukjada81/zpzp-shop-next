// src/lib/slug-resolve.ts
export type SlugKind = "tenant" | "linker" | "none";
export interface SlugResolution { kind: SlugKind; tenantSlug: string | null }
export interface CacheEntry { result: SlugResolution; expiresAt: number }

const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

/** 만료 안 된 캐시만 반환. 순수 함수(테스트 용이). */
export function pickCached(c: Map<string, CacheEntry>, slug: string, now: number): SlugResolution | null {
    const hit = c.get(slug);
    if (!hit) return null;
    if (hit.expiresAt <= now) return null;
    return hit.result;
}

/** slug 해석 + 캐시. 실패 시 fail-open(기존 tenant 동작 유지) — API 장애가 사이트를 막지 않게. */
export async function getSlugResolution(slug: string, apiBase: string, now: number): Promise<SlugResolution> {
    const cached = pickCached(cache, slug, now);
    if (cached) return cached;
    try {
        const res = await fetch(`${apiBase}/v1/resolve-slug?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`resolve-slug ${res.status}`);
        const result = (await res.json()) as SlugResolution;
        cache.set(slug, { result, expiresAt: now + TTL_MS });
        return result;
    } catch {
        return { kind: "tenant", tenantSlug: slug }; // fail-open
    }
}
