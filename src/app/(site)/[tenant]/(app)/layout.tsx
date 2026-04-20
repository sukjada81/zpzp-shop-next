// src/app/(site)/[tenant]/(app)/layout.tsx
import AppShellClient from "@/components/layout/AppShellClient";
import { tenantFromParams } from "@/lib/tenant/getTenant";

export default async function AppLayout({
                                            children,
                                            params,
                                        }: {
    children: React.ReactNode;
    params: Promise<{ tenant: string }> | { tenant: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = tenantFromParams(resolved);

    return (
        <AppShellClient tenant={tenant} tenantName="">
            {children}
        </AppShellClient>
    );
}