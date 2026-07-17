import { describe, it, expect } from "vitest";
import { pickCached, type CacheEntry, type SlugResolution } from "./slug-resolve";
const R: SlugResolution = { kind: "linker", tenantSlug: "funcher" };
describe("pickCached", () => {
  it("미만료면 캐시 반환", () => {
    const c = new Map<string, CacheEntry>([["a", { result: R, expiresAt: 1000 }]]);
    expect(pickCached(c, "a", 999)).toEqual(R);
  });
  it("만료면 null", () => {
    const c = new Map<string, CacheEntry>([["a", { result: R, expiresAt: 1000 }]]);
    expect(pickCached(c, "a", 1001)).toBeNull();
  });
  it("없으면 null", () => {
    expect(pickCached(new Map(), "x", 0)).toBeNull();
  });
});
