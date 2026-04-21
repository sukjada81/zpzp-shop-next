// src/app/(seller)/seller/[tenant]/sales/page.tsx
import { notFound } from "next/navigation";
import SellerSalesStatsClient from "@/components/seller/SellerSalesStatsClient";
import type { SellerSalesResponse } from "@/lib/types/seller";
import SellerNoAccess from "@/components/seller/SellerNoAccess";
import SellerGlobalNotSupported from "@/components/seller/SellerGlobalNotSupported";
import {
    fetchSellerApi,
    getCookieHeader,
    getInternalOrigin,
    isAuthError,
} from "@/lib/seller/fetchSeller";

export default async function SellerSalesPage({
    params,
    searchParams,
}: {
    params: Promise<{ tenant: string }> | { tenant: string };
    searchParams:
        | Promise<Record<string, string | string[] | undefined>>
        | Record<string, string | string[] | undefined>;
}) {
    const resolved = await Promise.resolve(params);
    const tenant = String(resolved?.tenant ?? "").trim();

    if (!tenant) notFound();
    if (tenant === "__all__") return <SellerGlobalNotSupported pageLabel="매출통계" />;

    const resolvedSearchParams = await Promise.resolve(searchParams);
    const origin = getInternalOrigin();
    const url = new URL(`/api/seller/${tenant}/sales`, origin);
    const cookie = await getCookieHeader();

    for (const [key, value] of Object.entries(resolvedSearchParams)) {
        if (typeof value === "string" && value.trim()) {
            url.searchParams.set(key, value);
        }
    }

    const result = await fetchSellerApi<SellerSalesResponse>(url, cookie, tenant);

    if (!result.ok) {
        if (isAuthError(result.status)) return <SellerNoAccess tenant={tenant} />;
        notFound();
    }

    return <SellerSalesStatsClient tenant={tenant} data={result.data} />;
}
