// src/app/(seller)/seller/[tenant]/page.tsx
import { notFound, redirect } from "next/navigation";
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
    const cookie = await getCookieHeader();

    const accessUrl = new URL(`/api/seller/${tenant}/access-check`, origin);
    const access = await fetchSellerApi<{ ok: boolean; status?: string; role?: string }>(accessUrl, cookie, tenant);
    if (access.ok && access.data.status === "active" && access.data.role === "linker") {
        redirect(`/seller/${tenant}/products`);
    }

    // 전체 지점 합산 대시보드 (hq_super 전용)
    if (tenant === "__all__") {
        const url = new URL(`/api/seller/__all__/global/dashboard`, origin);
        const result = await fetchSellerApi<SellerDashboardData>(url, cookie, "__all__");

        if (!result.ok) {
            if (isAuthError(result.status)) return <SellerNoAccess tenant={tenant} />;
            notFound();
        }

        return <SellerDashboardClient tenant="__all__" data={result.data} />;
    }

    const url = new URL(`/api/seller/${tenant}/dashboard`, origin);
    const result = await fetchSellerApi<SellerDashboardData>(url, cookie, tenant);

    if (!result.ok) {
        if (isAuthError(result.status)) return <SellerNoAccess tenant={tenant} />;
        notFound();
    }

    return <SellerDashboardClient tenant={tenant} data={result.data} />;
}
