// src/app/(seller)/seller/[tenant]/applications/page.tsx
import { notFound } from "next/navigation";
import SellerApplicationsClient, {
    type ApplicationItem,
} from "@/components/seller/SellerApplicationsClient";
import SellerNoAccess from "@/components/seller/SellerNoAccess";
import {
    fetchSellerApi,
    getCookieHeader,
    getInternalOrigin,
    isAuthError,
} from "@/lib/seller/fetchSeller";

type ApplicationsResponse = { ok: boolean; items?: ApplicationItem[] };

type StatusFilter = "pending" | "active" | "all";

export default async function SellerApplicationsPage({
    params,
    searchParams,
}: {
    params: Promise<{ tenant: string }> | { tenant: string };
    searchParams?: Promise<{ status?: string }> | { status?: string };
}) {
    const resolved = await Promise.resolve(params);
    const resolvedSearch = await Promise.resolve(searchParams);
    const tenant = String(resolved?.tenant ?? "").trim();

    if (!tenant) notFound();

    const validStatuses = ["pending", "active", "all"];
    const rawStatus = String(resolvedSearch?.status ?? "all").trim();
    const statusFilter = (validStatuses.includes(rawStatus) ? rawStatus : "all") as StatusFilter;

    const origin = getInternalOrigin();
    const url = new URL(`/api/seller/${tenant}/applications`, origin);
    url.searchParams.set("status", statusFilter);
    const cookie = await getCookieHeader();

    const result = await fetchSellerApi<ApplicationsResponse>(url, cookie, tenant);

    if (!result.ok) {
        if (isAuthError(result.status)) return <SellerNoAccess tenant={tenant} />;
        notFound();
    }

    const items = result.data.items ?? [];
    const pendingCount = items.filter((i) => i.status === "pending").length;

    return (
        <SellerApplicationsClient
            tenant={tenant}
            initialItems={items}
            initialStatus={statusFilter}
            initialPendingCount={pendingCount}
        />
    );
}
