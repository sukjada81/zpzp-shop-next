import type { Metadata } from "next";
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
        openchatUrl?: string | null;
    };
};

type TenantInfo = { name: string; primaryDomain: string | null };

async function fetchTenantInfo(tenant: string): Promise<TenantInfo> {
    if (!tenant) return { name: "", primaryDomain: null };
    try {
        const url = new URL(endpoints.publicTenant(tenant), getInternalOrigin());
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (res.ok) {
            const data = (await res.json()) as TenantInfoResponse;
            return {
                name: data?.item?.name?.trim() || "",
                primaryDomain: data?.item?.primaryDomain ?? null,
            };
        }
    } catch {}
    return { name: "", primaryDomain: null };
}

function buildMetadataBase(tenant: string, primaryDomain: string | null): URL {
    if (primaryDomain) {
        return new URL(`https://${primaryDomain}`);
    }
    const baseDomain = process.env.TENANT_BASE_DOMAIN || "discountallday.kr";
    const isDev = process.env.NODE_ENV === "development";
    const port = isDev ? `:${process.env.NEXT_PUBLIC_LOCAL_TENANT_PORT || "3000"}` : "";
    const protocol = isDev ? "http" : "https";
    return new URL(`${protocol}://${tenant}.${baseDomain}${port}`);
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ tenant: string }> | { tenant: string };
}): Promise<Metadata> {
    const resolved = await Promise.resolve(params);
    const tenant = normalizeTenant(resolved?.tenant || "");
    const { name: tenantName, primaryDomain } = await fetchTenantInfo(tenant);

    const title = tenantName ? `디스카운트올데이 ${tenantName}` : "디스카운트올데이";
    const description = tenantName
        ? `${tenantName} | 365일 초특가 할인매장`
        : "365일 초특가 할인매장";
    const metadataBase = buildMetadataBase(tenant, primaryDomain);

    return {
        metadataBase,
        title,
        description,
        icons: { icon: "/favicon.ico" },
        openGraph: {
            title,
            description,
            siteName: "디스카운트올데이",
            type: "website",
            images: [{ url: "/logo.png", width: 400, height: 160, alt: "디스카운트올데이" }],
        },
    };
}

export default async function AppLayout({
                                            children,
                                            params,
                                        }: {
    children: React.ReactNode;
    params: Promise<{ tenant: string }> | { tenant: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = normalizeTenant(resolved?.tenant || "");

    const { name: tenantName } = await fetchTenantInfo(tenant);

    return (
        <AppShellClient tenant={tenant} tenantName={tenantName}>
            {children}
        </AppShellClient>
    );
}