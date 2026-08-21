/**
 * 본사 배송조회 — mallRN_configuration.delivery_info + order_goods.delivery_info
 * delivery_info 형식: "택배사코드|송장번호"
 * configuration: "max|*|code|name|url|used|*|..."
 */
import type { PrismaClient } from "@prisma/client";

export type DeliveryCarrier = {
    code: string;
    name: string;
    trackUrl: string;
};

export type DeliveryTrackingInfo = {
    canTrack: boolean;
    carrierCode: string;
    carrierName: string;
    invoiceNo: string;
    /** window.open(trackUrl + invoiceNo) — 본사와 동일 */
    trackUrl: string;
};

function toSafeString(value: unknown, fallback = ""): string {
    const text = String(value ?? "").trim();
    return text || fallback;
}

function normalizeInvoice(raw: string): string {
    return raw.replace(/[-\s\n\r]/g, "");
}

/** mallRN_configuration.delivery_info → code map (used=1 만, 본사 order_list 와 동일) */
export function parseDeliveryCarrierMap(raw: string | null | undefined): Map<string, DeliveryCarrier> {
    const map = new Map<string, DeliveryCarrier>();
    const text = String(raw ?? "").trim();
    if (!text) return map;

    const parts = text.split("|*|");
    for (let i = 1; i < parts.length; i += 1) {
        const chunk = String(parts[i] ?? "").trim();
        if (!chunk || chunk === "|||") continue;
        const fields = chunk.split("|");
        const code = toSafeString(fields[0], "");
        const name = toSafeString(fields[1], "");
        const trackUrl = toSafeString(fields[2], "");
        const used = toSafeString(fields[3], "1");
        if (!code || used === "0") continue;
        map.set(code, { code, name, trackUrl });
    }
    return map;
}

/**
 * 품목 delivery_info + 상태 → 조회 가능 여부.
 * 본사: status==3 또는 (status==7 && status2==4)
 */
export function resolveDeliveryTracking(
    deliveryInfoRaw: string | null | undefined,
    status: number,
    status2: number,
    carriers: Map<string, DeliveryCarrier>
): DeliveryTrackingInfo {
    const empty: DeliveryTrackingInfo = {
        canTrack: false,
        carrierCode: "",
        carrierName: "",
        invoiceNo: "",
        trackUrl: "",
    };

    const raw = toSafeString(deliveryInfoRaw, "");
    if (!raw || !raw.includes("|")) return empty;

    const [codePart, ...rest] = raw.split("|");
    const carrierCode = toSafeString(codePart, "");
    const invoiceNo = normalizeInvoice(rest.join("|"));
    if (!carrierCode || !invoiceNo) return empty;

    const carrier = carriers.get(carrierCode);
    const carrierName = carrier?.name ?? "";
    const trackUrl = carrier?.trackUrl ?? "";

    const statusOk = status === 3 || (status === 7 && status2 === 4);
    const canTrack = statusOk && Boolean(trackUrl);

    return {
        canTrack,
        carrierCode,
        carrierName,
        invoiceNo,
        trackUrl,
    };
}

export async function loadDeliveryCarrierMap(
    prisma: PrismaClient
): Promise<Map<string, DeliveryCarrier>> {
    const conf = await prisma.mallRN_configuration.findFirst({
        where: { uid: 1 },
        select: { delivery_info: true },
    });
    return parseDeliveryCarrierMap(conf?.delivery_info);
}
