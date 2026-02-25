// src/lib/admin/adminAuthClient.ts
function baseUrl() {
    const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
    if (env) return env.startsWith("http") ? env : `https://${env}`;
    return "http://localhost:3000";
}

async function postJson<T>(path: string, body: unknown) {
    const url = new URL(path, baseUrl());
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
        cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json as T;
}

export async function adminLogin(id: string, password: string) {
    return postJson<{ ok: true } | { ok: false; message?: string }>("/api/proxy/admin/auth/login", {
        id,
        password,
    });
}

export async function adminLogout() {
    return postJson<{ ok: true }>("/api/proxy/admin/auth/logout", {});
}