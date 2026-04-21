// src/app/(seller)/seller/[tenant]/page.tsx
import { notFound } from "next/navigation";
import SellerDashboardClient, {
    type SellerDashboardData,
} from "@/components/seller/SellerDashboardClient";
import SellerNoAccess from "@/components/seller/SellerNoAccess";
import {
    fetchSellerApi,
    getCookieHeader,
    getInternalOrigin,
    isAuthError,
} from "@/lib/seller/fetchSeller";

export default async function SellerDashboardPage({
    params,
}: {
    params: Promise<{ tenant: string }> | { tenant: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = String(resolved?.tenant ?? "").trim();

    if (!tenant) notFound();

    const origin = getInternalOrigin();
    const url = new URL(`/api/seller/${tenant}/dashboard`, origin);
    const cookie = await getCookieHeader();

    const result = await fetchSellerApi<SellerDashboardData>(url, cookie, tenant);

    if (!result.ok) {
        if (isAuthError(result.status)) return <SellerNoAccess tenant={tenant} />;
        notFound();
    }

    return <SellerDashboardClient tenant={tenant} data={result.data} />;
}
