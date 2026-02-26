// src/app/(site)/[tenant]/(app)/layout.tsx
import AppShellClient from "@/components/layout/AppShellClient";

export default async function AppLayout({
                                            children,
                                            params,
                                        }: {
    children: React.ReactNode;
    params: Promise<{ tenant: string }>;
}) {
    const resolved = await params;
    const tenant = (resolved?.tenant || "").toLowerCase().trim();

    return <AppShellClient tenant={tenant}>{children}</AppShellClient>;
}