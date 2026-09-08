/**
 * 쿠팡식 취소·반품 사유 + 변심 안내 + 하자 사진 메타.
 * 기본 문구는 코드에 두고, 숫자 설정만 zpzp_setting 으로 바꾼다.
 */
export type ClaimCause = "change_of_mind" | "defect";

export type ClaimReasonItem = {
    code: string;
    label: string;
    cause: ClaimCause;
};

export const CLAIM_REASONS: ClaimReasonItem[] = [
    { code: "mind_simple", cause: "change_of_mind", label: "단순 변심 (필요 없어짐)" },
    { code: "mind_wrong_order", cause: "change_of_mind", label: "다른 상품·옵션을 잘못 주문함" },
    { code: "mind_size_color", cause: "change_of_mind", label: "사이즈·색상·디자인이 생각과 다름" },
    { code: "mind_cheaper", cause: "change_of_mind", label: "다른 곳에서 더 저렴한 상품을 발견함" },
    { code: "mind_delay", cause: "change_of_mind", label: "배송이 너무 늦어짐" },
    { code: "defect_broken", cause: "defect", label: "상품 불량·고장" },
    { code: "defect_damaged", cause: "defect", label: "배송 중 파손" },
    { code: "defect_wrong_item", cause: "defect", label: "오배송 (다른 상품이 옴)" },
    { code: "defect_missing", cause: "defect", label: "구성품·부품 누락" },
    { code: "defect_mismatch", cause: "defect", label: "상세페이지 설명과 다름" },
    { code: "defect_expired", cause: "defect", label: "유통기한 경과·임박" },
];

export const MIND_CONDITION_NOTICE = [
    "변심 반품은 상품이 사용하지 않은 완전한 상태로 돌아와야 합니다.",
    "택·태그, 구성품, 사은품이 모두 있어야 하고 포장 훼손·사용 흔적·세탁이 있으면 반품이 거절될 수 있습니다.",
    "회수가 시작되기 전에는 이 신청을 철회할 수 있습니다.",
].join(" ");

export const DEFECT_PHOTO_NOTICE =
    "하자·파손·오배송이 보이는 사진을 올려 주세요. 본사가 확인한 뒤에 배송비 면제가 확정됩니다.";

export type ClaimPolicySettings = {
    photoMin: number;
    photoMax: number;
    exchangeLimit: number;
    withdrawUntil: "request" | "before_pickup";
    mindConfirmRequired: boolean;
    mindNotice: string;
    defectPhotoNotice: string;
};

export const DEFAULT_CLAIM_POLICY: ClaimPolicySettings = {
    photoMin: 1,
    photoMax: 5,
    exchangeLimit: 1,
    withdrawUntil: "before_pickup",
    mindConfirmRequired: true,
    mindNotice: MIND_CONDITION_NOTICE,
    defectPhotoNotice: DEFECT_PHOTO_NOTICE,
};

export type ClaimMeta = {
    code: string;
    photos: string[];
    detail: string;
};

const META_MARK = "[[CLAIM]]";

export function reasonsForCause(cause: ClaimCause): ClaimReasonItem[] {
    return CLAIM_REASONS.filter((row) => row.cause === cause);
}

export function findClaimReason(code: string): ClaimReasonItem | null {
    return CLAIM_REASONS.find((row) => row.code === code) ?? null;
}

export function encodeClaimMessage(meta: ClaimMeta): string {
    const payload = JSON.stringify({
        code: String(meta.code || ""),
        photos: (meta.photos || []).filter(Boolean).slice(0, 8),
        detail: String(meta.detail || "").trim().slice(0, 1000),
    });
    const detail = String(meta.detail || "").trim();
    return detail ? `${detail}\n${META_MARK}${payload}` : `${META_MARK}${payload}`;
}

export function parseClaimMessage(message: unknown): ClaimMeta {
    const text = String(message ?? "");
    const idx = text.lastIndexOf(META_MARK);
    if (idx < 0) {
        return { code: "", photos: [], detail: text.trim() };
    }
    const before = text.slice(0, idx).trim();
    try {
        const json = JSON.parse(text.slice(idx + META_MARK.length));
        const photos = Array.isArray(json?.photos)
            ? json.photos.map((v: unknown) => String(v || "").trim()).filter(Boolean)
            : [];
        return {
            code: String(json?.code ?? ""),
            photos,
            detail: String(json?.detail ?? before).trim() || before,
        };
    } catch {
        return { code: "", photos: [], detail: before };
    }
}

export function canWithdrawClaim(input: {
    status: number;
    status2: number;
    cause: ClaimCause | "unknown";
    withdrawUntil: "request" | "before_pickup";
}): boolean {
    if (input.status !== 7 && input.status !== 8) return false;
    if (input.status2 === 1) return true;
    if (
        input.withdrawUntil === "before_pickup" &&
        input.cause === "change_of_mind" &&
        input.status2 === 2
    ) {
        return true;
    }
    return false;
}

export async function loadClaimPolicySettings(prisma: {
    zpzp_setting: { findMany: (args: { where: { name: { in: string[] } } }) => Promise<Array<{ name: string; value: string }>> };
}): Promise<ClaimPolicySettings> {
    const rows = await prisma.zpzp_setting.findMany({
        where: {
            name: {
                in: [
                    "return_photo_min",
                    "return_exchange_limit",
                    "return_withdraw_until",
                    "return_mind_confirm",
                ],
            },
        },
    });
    const map = new Map(rows.map((row) => [row.name, String(row.value ?? "").trim()]));
    const photoMin = Math.max(0, Math.min(5, Number(map.get("return_photo_min") || DEFAULT_CLAIM_POLICY.photoMin)));
    const exchangeLimit = Math.max(1, Math.min(5, Number(map.get("return_exchange_limit") || DEFAULT_CLAIM_POLICY.exchangeLimit)));
    const withdrawUntil =
        map.get("return_withdraw_until") === "request" ? "request" : "before_pickup";
    const mindConfirmRequired = map.get("return_mind_confirm") !== "0";
    return {
        ...DEFAULT_CLAIM_POLICY,
        photoMin: Number.isFinite(photoMin) ? photoMin : 1,
        exchangeLimit: Number.isFinite(exchangeLimit) ? exchangeLimit : 1,
        withdrawUntil,
        mindConfirmRequired,
    };
}

export function serializeClaimPolicy(settings: ClaimPolicySettings) {
    return {
        ...settings,
        reasons: {
            change_of_mind: reasonsForCause("change_of_mind"),
            defect: reasonsForCause("defect"),
        },
    };
}

const PHOTO_PATH_RE = /^uploads\/claims\/\d{4}\/\d{2}\/[A-Za-z0-9._-]+$/;

export function sanitizeClaimPhotoPaths(input: unknown, max = 5): string[] {
    if (!Array.isArray(input)) return [];
    const out: string[] = [];
    for (const raw of input) {
        const p = String(raw || "")
            .trim()
            .replace(/^\/+/, "");
        if (!PHOTO_PATH_RE.test(p)) continue;
        out.push(`/${p}`);
        if (out.length >= max) break;
    }
    return out;
}

export function validateClaimApplication(input: {
    cause: ClaimCause;
    reasonCode: string;
    photos: string[];
    mindConfirmed: boolean;
    settings: ClaimPolicySettings;
}): { ok: true; reason: ClaimReasonItem } | { ok: false; message: string } {
    const reason = findClaimReason(String(input.reasonCode || "").trim());
    if (!reason || reason.cause !== input.cause) {
        return { ok: false, message: "상세 사유를 선택해 주세요." };
    }
    if (
        input.cause === "change_of_mind" &&
        input.settings.mindConfirmRequired &&
        !input.mindConfirmed
    ) {
        return {
            ok: false,
            message: "변심 반품·교환은 상품이 사용하지 않은 완전한 상태임을 확인해 주세요.",
        };
    }
    if (input.cause === "defect" && input.photos.length < input.settings.photoMin) {
        return {
            ok: false,
            message: `하자 증빙 사진을 ${input.settings.photoMin}장 이상 올려 주세요.`,
        };
    }
    return { ok: true, reason };
}
