import { describe, expect, it } from "vitest";
import {
    canWithdrawClaim,
    encodeClaimMessage,
    parseClaimMessage,
    sanitizeClaimPhotoPaths,
    validateClaimApplication,
    DEFAULT_CLAIM_POLICY,
} from "./claim-policy.js";

describe("claim-policy", () => {
    it("encodes and parses claim message", () => {
        const raw = encodeClaimMessage({
            code: "defect_broken",
            photos: ["/uploads/claims/2026/09/a.jpg"],
            detail: "뚜껑이 깨짐",
        });
        const parsed = parseClaimMessage(raw);
        expect(parsed.code).toBe("defect_broken");
        expect(parsed.photos).toEqual(["/uploads/claims/2026/09/a.jpg"]);
        expect(parsed.detail).toBe("뚜껑이 깨짐");
    });

    it("rejects defect without photos", () => {
        const checked = validateClaimApplication({
            cause: "defect",
            reasonCode: "defect_broken",
            photos: [],
            mindConfirmed: false,
            settings: DEFAULT_CLAIM_POLICY,
        });
        expect(checked.ok).toBe(false);
    });

    it("allows mind withdraw before pickup", () => {
        expect(
            canWithdrawClaim({
                status: 8,
                status2: 2,
                cause: "change_of_mind",
                withdrawUntil: "before_pickup",
            })
        ).toBe(true);
        expect(
            canWithdrawClaim({
                status: 8,
                status2: 2,
                cause: "defect",
                withdrawUntil: "before_pickup",
            })
        ).toBe(false);
    });

    it("sanitizes photo paths", () => {
        expect(
            sanitizeClaimPhotoPaths([
                "/uploads/claims/2026/09/a.jpg",
                "https://evil.example/x.jpg",
                "../secret",
            ])
        ).toEqual(["/uploads/claims/2026/09/a.jpg"]);
    });
});
