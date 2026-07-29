// src/lib/profile/quickOrderProfile.ts
import { tenantHeader } from "@/lib/api/endpoints";

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

export function mergeQuickOrderProfile(
    incoming: QuickOrderProfile,
    existing?: QuickOrderProfile | null
): QuickOrderProfile {
    const pick = (next?: string, prev?: string) => String(next ?? "").trim() || String(prev ?? "").trim();

    return {
        nickname: pick(incoming.nickname, existing?.nickname),
        phone: normalizeQuickOrderPhone(incoming.phone || existing?.phone),
        recommenderNickname: pick(incoming.recommenderNickname, existing?.recommenderNickname),
        postcode: pick(incoming.postcode, existing?.postcode),
        address1: pick(incoming.address1, existing?.address1),
        address2: pick(incoming.address2, existing?.address2),
    };
}

/** 로컬 프로필 + 회원 DB(mallRN_member)에 함께 저장 */
export async function persistQuickOrderProfile(
    tenant: string,
    profile: QuickOrderProfile,
    options?: { overwriteEmptyAddress?: boolean }
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
    const existing = readQuickOrderProfile(tenant);
    const merged = options?.overwriteEmptyAddress
        ? {
              nickname: String(profile.nickname ?? "").trim(),
              phone: normalizeQuickOrderPhone(profile.phone),
              recommenderNickname: String(profile.recommenderNickname ?? "").trim(),
              postcode: String(profile.postcode ?? "").trim(),
              address1: String(profile.address1 ?? "").trim(),
              address2: String(profile.address2 ?? "").trim(),
          }
        : mergeQuickOrderProfile(profile, existing);

    saveQuickOrderProfile(tenant, merged);

    const body: Record<string, string> = {};
    if (merged.nickname) body.nickname = merged.nickname;
    if (merged.phone) body.phone = merged.phone;
    if (merged.recommenderNickname) body.reference = merged.recommenderNickname;

    if (options?.overwriteEmptyAddress) {
        if (profile.postcode !== undefined) body.postcode = String(profile.postcode ?? "").trim();
        if (profile.address1 !== undefined) body.address1 = String(profile.address1 ?? "").trim();
        if (profile.address2 !== undefined) body.address2 = String(profile.address2 ?? "").trim();
    } else {
        if (merged.postcode) body.postcode = merged.postcode;
        if (merged.address1) body.address1 = merged.address1;
        if (merged.address2) body.address2 = merged.address2;
    }

    if (Object.keys(body).length === 0) {
        return { ok: false, status: 400, message: "저장할 정보가 없습니다." };
    }

    const res = await fetch("/api/proxy/v1/public/member/reference", {
        method: "PATCH",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...tenantHeader(tenant),
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        return {
            ok: false,
            status: res.status,
            message: String(data?.message ?? `HTTP ${res.status}`),
        };
    }

    return { ok: true };
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
