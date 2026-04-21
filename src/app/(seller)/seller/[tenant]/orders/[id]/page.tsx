// src/app/(seller)/seller/[tenant]/orders/[id]/page.tsx
import { notFound } from "next/navigation";
import SellerOrderDetailClient from "@/components/seller/SellerOrderDetailClient";
import SellerNoAccess from "@/components/seller/SellerNoAccess";
import {
    fetchSellerApi,
    getCookieHeader,
    getInternalOrigin,
    isAuthError,
} from "@/lib/seller/fetchSeller";

type OrderDetailResponse = { ok: boolean; [key: string]: unknown };

export default async function SellerOrderDetailPage({
    params,
}: {
    params: Promise<{ tenant: string; id: string }> | { tenant: string; id: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = String(resolved?.tenant ?? "").trim();
    const id = String(resolved?.id ?? "").trim();

    if (!tenant || !id) notFound();

    const origin = getInternalOrigin();
    const url = new URL(`/api/seller/${tenant}/orders/${id}`, origin);
    const cookie = await getCookieHeader();

    const result = await fetchSellerApi<OrderDetailResponse>(url, cookie, tenant);

    if (!result.ok) {
        if (isAuthError(result.status)) return <SellerNoAccess tenant={tenant} />;
        notFound();
    }

    return <SellerOrderDetailClient tenant={tenant} id={id} />;
}
