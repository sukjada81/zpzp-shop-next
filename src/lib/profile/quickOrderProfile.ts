// src/lib/profile/quickOrderProfile.ts
export type QuickOrderProfile = {
    nickname: string;
    phone?: string;
};

function onlyDigits(v: string) {
    return String(v ?? "").replace(/[^\d]/g, "");
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

    if (!nickname) return null;

    return {
        nickname,
        phone: phone || "",
    };
}

export function readQuickOrderProfile(tenant: string): QuickOrderProfile | null {
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

            if (!key.includes(tenant) && !key.toLowerCase().includes("profile") && !key.toLowerCase().includes("setting")) {
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