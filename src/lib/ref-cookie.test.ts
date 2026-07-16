// src/lib/ref-cookie.test.ts
import { describe, it, expect } from "vitest";
import { resolveRefCookie } from "./ref-cookie";

describe("resolveRefCookie (first-write-wins)", () => {
  it("sets slug when no existing ref", () => {
    expect(resolveRefCookie(undefined, "shopA")).toBe("shopA");
  });

  it("does not overwrite existing ref (first-touch)", () => {
    expect(resolveRefCookie("shopA", "shopB")).toBeNull();
  });

  it("null when no subdomain", () => {
    expect(resolveRefCookie(undefined, null)).toBeNull();
  });
});
