// src/app/(site)/[tenant]/layout.tsx
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CartProvider } from "@/lib/cart/CartProvider";
import { getTenantList } from "@/lib/tenant/tenants";

function normalizeTenant(raw: string) {
    const t = (raw || "").toLowerCase().trim();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

function isKnownTenant(tenant: string) {
    const list = getTenantList();
    return list.some((t) => normalizeTenant((t as any).slug) === tenant);
}

export default async function SiteTenantLayout({
                                                   children,
                                                   params,
                                               }: {
    children: ReactNode;
    params: { tenant: string } | Promise<{ tenant: string }>;
}) {
    const resolved = await Promise.resolve(params);
    const tenant = normalizeTenant(resolved?.tenant);

    if (!tenant) notFound();

    if (!isKnownTenant(tenant)) notFound();

    return <CartProvider>{children}</CartProvider>;
}