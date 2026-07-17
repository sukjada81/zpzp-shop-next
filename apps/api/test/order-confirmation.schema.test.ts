import { describe, it, expect, beforeEach } from "vitest";
import { getTestPrisma, resetZpzpTables } from "./setup";
const prisma = getTestPrisma();
describe("order confirmation schema", () => {
  beforeEach(() => resetZpzpTables(prisma));
  it("UNIQUE(order_goods_uid) + defaults", async () => {
    const c = await prisma.zpzp_order_confirmation.create({ data: { order_goods_uid: 7001, order_num: "O1", timer_state: "running" } });
    expect(c.paused_total_seconds).toBe(0);
    expect(c.is_crew_trigger).toBe(false);
    await expect(prisma.zpzp_order_confirmation.create({ data: { order_goods_uid: 7001, order_num: "O1", timer_state: "running" } })).rejects.toThrow();
  });
  it("timer event append", async () => {
    const c = await prisma.zpzp_order_confirmation.create({ data: { order_goods_uid: 7002, order_num: "O2", timer_state: "paused" } });
    const e = await prisma.zpzp_confirmation_timer_event.create({ data: { order_confirmation_uid: c.uid, order_goods_uid: 7002, event_type: "pause", reason: "exchange" } });
    expect(e.event_type).toBe("pause");
  });
});
