import { ReactNode } from "react";
import { notFound } from "next/navigation";

import AppShellClient from "@/components/layout/AppShellClient";
import { getTenantBySlug } from "@/lib/tenant/getTenant";

export default async function TenantLayout({
                                               children,
                                               params,
                                           }: {
    children: ReactNode;
    params: { tenant: string };
}) {
    const tenant = await getTenantBySlug(params.tenant);

    if (!tenant) {
        notFound();
    }

    return (
        <AppShellClient tenant={tenant.slug} tenantName={tenant.name}>
            {children}
        </AppShellClient>
    );
}