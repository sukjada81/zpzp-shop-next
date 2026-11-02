import { describe, expect, it } from "vitest";
import {
    isSlotRegistrationBlocked,
    isUnlimitedSlot,
    slotExceededCount,
    slotRegistrationBlockCode,
} from "./slot-limit.js";

describe("linker slot limit", () => {
    it("treats 0 as unlimited", () => {
        expect(isUnlimitedSlot(0)).toBe(true);
        expect(isUnlimitedSlot(10)).toBe(false);
        expect(slotExceededCount(0, 40)).toBe(0);
        expect(isSlotRegistrationBlocked(0, 0)).toBe(false);
        expect(isSlotRegistrationBlocked(0, 25)).toBe(false);
        expect(slotRegistrationBlockCode(0, 25, 3)).toBeNull();
    });

    it("keeps a positive limit", () => {
        expect(isSlotRegistrationBlocked(10, 10)).toBe(true);
        expect(isSlotRegistrationBlocked(10, 9)).toBe(false);
        expect(slotExceededCount(10, 12)).toBe(2);
        expect(slotRegistrationBlockCode(10, 11, 1)).toBe("SLOT_EXCEEDED");
        expect(slotRegistrationBlockCode(10, 9, 2)).toBe("SLOT_SHORTAGE");
        expect(slotRegistrationBlockCode(10, 8, 2)).toBeNull();
    });
});
