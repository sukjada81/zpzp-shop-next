// src/lib/seller/fetchSeller.ts
import { cookies } from "next/headers";

export type FetchOk<T> = { ok: true; data: T };
export type FetchErr = { ok: false; status: number };
export type FetchResult<T> = FetchOk<T> | FetchErr;

export function isAuthError(status: number): boolean {
    return status === 401 || status === 403;
}

export function getInternalOrigin(): string {
    return (
        process.env.NEXT_INTERNAL_ORIGIN ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://127.0.0.1:3000"
    );
}

export async function getCookieHeader(): Promise<string> {
    const store = await cookies();
    return store
        .getAll()
        .map((item) => `${item.name}=${item.value}`)
        .join("; ");
}

export async function fetchSellerApi<T extends { ok: boolean }>(
    url: string | URL,
    cookieHeader: string,
    tenant: string
): Promise<FetchResult<T>> {
    try {
        const res = await fetch(url.toString(), {
            cache: "no-store",
            headers: {
                cookie: cookieHeader,
                "x-tenant-slug": tenant,
                accept: "application/json",
            },
        });

        if (!res.ok) return { ok: false, status: res.status };

        const data = (await res.json().catch(() => null)) as T | null;
        if (!data?.ok) return { ok: false, status: res.status };

        return { ok: true, data };
    } catch {
        return { ok: false, status: 500 };
    }
}
