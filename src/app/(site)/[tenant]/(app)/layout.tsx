import AppShellClient from "@/components/layout/AppShellClient";
import { endpoints } from "@/lib/api/endpoints";

function normalizeTenant(raw: string) {
    const t = (raw || "").trim().toLowerCase();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

function getInternalOrigin() {
    return (
        process.env.NEXT_INTERNAL_ORIGIN ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://127.0.0.1:3000"
    );
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
            const url = new URL(endpoints.publicTenant(tenant), getInternalOrigin());

            const res = await fetch(url.toString(), {
                cache: "no-store",
            });

            if (res.ok) {
                const data = (await res.json()) as TenantInfoResponse;
                tenantName = data?.item?.name?.trim() || "";
            } else {
                console.error("APP_LAYOUT_TENANT_FETCH_NOT_OK", res.status, url.toString());
            }
        } catch (err) {
            console.error("APP_LAYOUT_TENANT_FETCH_FAILED", err);
        }
    }

    console.log("APP_LAYOUT_TENANT", { tenant, tenantName });

    return (
        <AppShellClient tenant={tenant} tenantName={tenantName}>
            {children}
        </AppShellClient>
    );
}