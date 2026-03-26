// src/app/(seller)/seller/[tenant]/sales/page.tsx
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import SellerSalesStatsClient from "@/components/seller/SellerSalesStatsClient";
import type { SellerSalesResponse } from "@/lib/types/seller";

function getInternalOrigin() {
    return (
        process.env.NEXT_INTERNAL_ORIGIN ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://127.0.0.1:3000"
    );
}

async function getCookieHeader() {
    const store = await cookies();
    return store
        .getAll()
        .map((item) => `${item.name}=${item.value}`)
        .join("; ");
}

async function fetchSellerSales(
    tenant: string,
    searchParams: Record<string, string | string[] | undefined>
): Promise<SellerSalesResponse | null> {
    const origin = getInternalOrigin();
    const url = new URL(`/api/seller/${tenant}/sales`, origin);
    const cookie = await getCookieHeader();

    for (const [key, value] of Object.entries(searchParams)) {
        if (typeof value === "string" && value.trim()) {
            url.searchParams.set(key, value);
        }
    }

    const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: {
            cookie,
            "x-tenant-slug": tenant,
        },
    });

    if (!res.ok) return null;

    const data = (await res.json().catch(() => null)) as SellerSalesResponse | null;
    if (!data?.ok) return null;

    return data;
}

export default async function SellerSalesPage({
                                                  params,
                                                  searchParams,
                                              }: {
    params: Promise<{ tenant: string }> | { tenant: string };
    searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
    const resolved = await Promise.resolve(params);
    const tenant = String(resolved?.tenant ?? "").trim();

    if (!tenant) notFound();

    const resolvedSearchParams = await Promise.resolve(searchParams);
    const data = await fetchSellerSales(tenant, resolvedSearchParams);

    if (!data) notFound();

    return <SellerSalesStatsClient tenant={tenant} data={data} />;
}