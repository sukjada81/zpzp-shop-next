import { describe, it, expect, beforeEach } from "vitest";
import { getTestPrisma, resetZpzpTables } from "../../../test/setup";
import { resolveSlug, HQ_STOREFRONT_SLUG } from "./resolve.routes";
const prisma = getTestPrisma();
describe("resolveSlug", () => {
  beforeEach(async () => {
    await resetZpzpTables(prisma);
    await prisma.$executeRawUnsafe("DELETE FROM dad_tenants WHERE slug IN ('funcher','other')");
    await prisma.$executeRawUnsafe("INSERT INTO dad_tenants (id, slug, name, status) VALUES (91,'funcher','펀처','active')");
  });
  it("tenant slug", async () => {
    expect(await resolveSlug(prisma, "funcher")).toEqual({ kind: "tenant", tenantSlug: "funcher" });
  });
  it("active linker → 단일 본사몰(hq) 컨텍스트 (소속 점포 무관)", async () => {
    // tenant_id 는 이제 무의미(NULL 방치). active 면 무조건 'hq' 로 resolve.
    await prisma.zpzp_linker.create({ data: { member_uid: 9001, shop_slug: "myshop", shop_name: "M", status: "active", tenant_id: null } });
    expect(await resolveSlug(prisma, "myshop")).toEqual({ kind: "linker", tenantSlug: HQ_STOREFRONT_SLUG });
  });
  it("non-active linker → none", async () => {
    await prisma.zpzp_linker.create({ data: { member_uid: 9002, shop_slug: "pend", shop_name: "P", status: "pending", tenant_id: null } });
    expect(await resolveSlug(prisma, "pend")).toEqual({ kind: "none", tenantSlug: null });
  });
  it("unknown → none", async () => {
    expect(await resolveSlug(prisma, "nobody")).toEqual({ kind: "none", tenantSlug: null });
  });
});
