// src/lib/profile/quickOrderProfile.ts
export type QuickOrderProfile = {
    nickname?: string;
    phone?: string;
    recommenderNickname?: string;
    postcode?: string;
    address1?: string;
    address2?: string;
};

function canUseStorage() {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function onlyDigits(v: string) {
    return String(v ?? "").replace(/[^\d]/g, "");
}

function profileKey(tenant: string) {
    return `profile:${tenant || "default"}`;
}

function dismissedKey(tenant: string) {
    return `profilePromptDismissed:${tenant || "default"}`;
}

function pickFirstText(obj: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = String(obj[key] ?? "").trim();
        if (value) return value;
    }
    return "";
}

function readFromObject(parsed: Record<string, unknown>): QuickOrderProfile | null {
    const nickname = pickFirstText(parsed, [
        "nickname",
        "name",
        "userName",
        "buyerName",
        "username",
    ]);

    const phone = onlyDigits(
        pickFirstText(parsed, ["phone", "cell", "mobile", "buyerPhone", "tel"])
    );

    const recommenderNickname = pickFirstText(parsed, [
        "recommenderNickname",
        "referrerNickname",
        "recommendedBy",
    ]);

    const postcode = pickFirstText(parsed, ["postcode", "zipcode"]);
    const address1 = pickFirstText(parsed, ["address1", "addr1", "address"]);
    const address2 = pickFirstText(parsed, ["address2", "addr2", "addressDetail"]);

    if (!nickname && !phone && !recommenderNickname && !postcode && !address1 && !address2) {
        return null;
    }

    return {
        nickname,
        phone: phone || "",
        recommenderNickname,
        postcode,
        address1,
        address2,
    };
}

export function normalizeQuickOrderPhone(v?: string) {
    return onlyDigits(String(v ?? ""));
}

export function isQuickOrderProfileComplete(profile?: QuickOrderProfile | null) {
    const nickname = String(profile?.nickname ?? "").trim();
    const phone = normalizeQuickOrderPhone(profile?.phone);
    return !!nickname && phone.length >= 10;
}

export function saveQuickOrderProfile(tenant: string, profile: QuickOrderProfile) {
    if (!canUseStorage()) return;

    const payload: QuickOrderProfile = {
        nickname: String(profile.nickname ?? "").trim(),
        phone: normalizeQuickOrderPhone(profile.phone),
        recommenderNickname: String(profile.recommenderNickname ?? "").trim(),
        postcode: String(profile.postcode ?? "").trim(),
        address1: String(profile.address1 ?? "").trim(),
        address2: String(profile.address2 ?? "").trim(),
    };

    window.localStorage.setItem(profileKey(tenant), JSON.stringify(payload));
    window.localStorage.removeItem(dismissedKey(tenant));
}

/** 로컬 프로필 + 회원 DB(mallRN_member)에 함께 저장 */
export async function persistQuickOrderProfile(tenant: string, profile: QuickOrderProfile) {
    saveQuickOrderProfile(tenant, profile);

    const body: Record<string, string> = {};
    const nickname = String(profile.nickname ?? "").trim();
    const phone = normalizeQuickOrderPhone(profile.phone);
    const reference = String(profile.recommenderNickname ?? "").trim();

    if (nickname) body.nickname = nickname;
    if (phone) body.phone = phone;
    if (reference) body.reference = reference;
    if (profile.postcode !== undefined) body.postcode = String(profile.postcode ?? "").trim();
    if (profile.address1 !== undefined) body.address1 = String(profile.address1 ?? "").trim();
    if (profile.address2 !== undefined) body.address2 = String(profile.address2 ?? "").trim();

    if (Object.keys(body).length === 0) return;

    await fetch("/api/proxy/v1/public/member/reference", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }).catch(() => null);
}

export function dismissProfilePrompt(tenant: string) {
    if (!canUseStorage()) return;
    window.localStorage.setItem(dismissedKey(tenant), "1");
}

export function hasDismissedProfilePrompt(tenant: string) {
    if (!canUseStorage()) return false;
    return window.localStorage.getItem(dismissedKey(tenant)) === "1";
}

export function shouldOpenProfileSetupModal(tenant: string) {
    const profile = readQuickOrderProfile(tenant);
    const noNickname = !String(profile?.nickname ?? "").trim();
    const noPhone = !normalizeQuickOrderPhone(profile?.phone);
    return noNickname && noPhone && !hasDismissedProfilePrompt(tenant);
}

export function readQuickOrderProfile(tenant: string): QuickOrderProfile | null {
    if (!canUseStorage()) return null;

    const keys = [
        `profile:${tenant}`,
        `profile:${tenant || "default"}`,
        "profile",
        `userProfile:${tenant}`,
        "userProfile",
        `settings:${tenant}`,
        "settings",
        `orderProfile:${tenant}`,
        "orderProfile",
    ];

    for (const key of keys) {
        try {
            const raw = window.localStorage.getItem(key);
            if (!raw) continue;

            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const profile = readFromObject(parsed);
            if (profile) return profile;
        } catch {
            // ignore
        }
    }

    try {
        for (let i = 0; i < window.localStorage.length; i += 1) {
            const key = window.localStorage.key(i);
            if (!key) continue;

            if (
                !key.includes(tenant) &&
                !key.toLowerCase().includes("profile") &&
                !key.toLowerCase().includes("setting")
            ) {
                continue;
            }

            const raw = window.localStorage.getItem(key);
            if (!raw) continue;

            try {
                const parsed = JSON.parse(raw) as Record<string, unknown>;
                const profile = readFromObject(parsed);
                if (profile) return profile;
            } catch {
                // ignore
            }
        }
    } catch {
        // ignore
    }

    return null;
}
