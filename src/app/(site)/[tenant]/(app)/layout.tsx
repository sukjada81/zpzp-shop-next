// src/app/(site)/[tenant]/(app)/layout.tsx
import AppShellClient from "@/components/layout/AppShellClient";
import { endpoints } from "@/lib/api/endpoints";

function normalizeTenant(raw: string) {
    const t = (raw || "").trim().toLowerCase();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

function resolveAppOrigin() {
    const explicit =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.APP_ORIGIN ||
        process.env.AUTH_ORIGIN ||
        "";

    if (explicit) {
        return explicit.replace(/\/+$/, "");
    }

    const port = process.env.PORT || "3000";
    return `http://127.0.0.1:${port}`;
}

type TenantInfoResponse = {
    ok: boolean;
    item?: {
        id: number;
        slug: string;
        name: string;
        primaryDomain?: string | null;
        timezone?: string | null;
        status?: string;
    };
};

export default async function AppLayout({
                                            children,
                                            params,
                                        }: {
    children: React.ReactNode;
    params: Promise<{ tenant: string }> | { tenant: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = normalizeTenant(resolved?.tenant || "");

    let tenantName = "";

    if (tenant) {
        try {
            const url = `${resolveAppOrigin()}${endpoints.publicTenant(tenant)}`;

            const res = await fetch(url, {
                method: "GET",
                cache: "no-store",
                headers: {
                    accept: "application/json",
                    "x-tenant-slug": tenant,
                },
            });

            if (res.ok) {
                const data = (await res.json()) as TenantInfoResponse;
                tenantName = data?.item?.name?.trim() || "";
            }
        } catch (err) {
            console.error("APP_LAYOUT_TENANT_FETCH_FAILED", err);
        }
    }

    return (
        <AppShellClient tenant={tenant} tenantName={tenantName}>
            {children}
        </AppShellClient>
    );
}