// src/lib/admin/adminAuthClient.ts
function baseUrl() {
    const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
    if (env) return env.startsWith("http") ? env : `https://${env}`;
    return "http://localhost:3000";
}

// src/lib/admin/adminAuthClient.ts
export async function postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        // 서버 메시지까지 같이 보이게(디버깅용)
        const msg = (data as any)?.message || `HTTP ${res.status}`;
        throw new Error(msg);
    }

    return data as T;
}

export async function adminLogin(id: string, password: string) {
    return postJson("/api/proxy/admin/auth/login", { id, password });
}

export async function adminLogout() {
    return postJson("/api/proxy/admin/auth/logout", {});
}