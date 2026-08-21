import { describe, expect, it } from "vitest";
import {
    parseDeliveryCarrierMap,
    resolveDeliveryTracking,
} from "./delivery-tracking.js";

describe("delivery-tracking", () => {
    const carriers = parseDeliveryCarrierMap(
        "10|*|01|CJ대한통운|https://trace.example/|1|*|02|한진|https://hanjin.example/|1|*|03|숨김|https://x/|0"
    );

    it("parses used carriers only", () => {
        expect(carriers.get("01")?.name).toBe("CJ대한통운");
        expect(carriers.get("02")?.trackUrl).toBe("https://hanjin.example/");
        expect(carriers.has("03")).toBe(false);
    });

    it("allows track for shipping status 3", () => {
        const t = resolveDeliveryTracking("01|1234-5678", 3, 0, carriers);
        expect(t.canTrack).toBe(true);
        expect(t.invoiceNo).toBe("12345678");
        expect(t.carrierName).toBe("CJ대한통운");
        expect(t.trackUrl).toBe("https://trace.example/");
    });

    it("blocks track when not shipped", () => {
        const t = resolveDeliveryTracking("01|12345678", 1, 0, carriers);
        expect(t.canTrack).toBe(false);
        expect(t.invoiceNo).toBe("12345678");
    });

    it("allows exchange re-delivery done (7/4)", () => {
        const t = resolveDeliveryTracking("02|ABC", 7, 4, carriers);
        expect(t.canTrack).toBe(true);
        expect(t.carrierName).toBe("한진");
    });
});
