import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CartProvider } from "@/lib/cart/CartProvider";

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000";

async function assertTenantExists(tenant: string) {
    const url = new URL(`/${tenant}/v1/public/products`, API_BASE);
    url.searchParams.set("take", "1");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return false;

    const data = await res.json().catch(() => null);
    if (!data || data.ok !== true) return false;
    if (data.tenant !== tenant) return false;

    return true;
}

export default async function AppLayout({
                                            children,
                                            params,
                                        }: {
    children: ReactNode;
    params: Promise<{ tenant: string }>;
}) {
    const { tenant: rawTenant } = await params;
    const tenant = (rawTenant || "").toLowerCase();

    if (!tenant) notFound();

    const ok = await assertTenantExists(tenant);
    if (!ok) notFound();

    return <CartProvider>{children}</CartProvider>;
}