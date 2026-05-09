// src/app/(seller)/seller/[tenant]/members/[id]/page.tsx
import { notFound } from "next/navigation";
import SellerMemberDetailClient, {
    type SellerMemberDetail,
} from "@/components/seller/SellerMemberDetailClient";
import SellerNoAccess from "@/components/seller/SellerNoAccess";
import {
    fetchSellerApi,
    getCookieHeader,
    getInternalOrigin,
    isAuthError,
} from "@/lib/seller/fetchSeller";

type MemberDetailResponse = { ok: boolean; item?: SellerMemberDetail };

export default async function SellerMemberDetailPage({
    params,
}: {
    params: Promise<{ tenant: string; id: string }> | { tenant: string; id: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = String(resolved?.tenant ?? "").trim();
    const id = String(resolved?.id ?? "").trim();

    if (!tenant || !id) notFound();

    const origin = getInternalOrigin();
    const url = new URL(`/api/seller/${tenant}/members/${id}`, origin);
    const cookie = await getCookieHeader();

    const result = await fetchSellerApi<MemberDetailResponse>(url, cookie, tenant);

    if (!result.ok) {
        if (isAuthError(result.status)) return <SellerNoAccess tenant={tenant} />;
        notFound();
    }

    if (!result.data.item) notFound();

    return <SellerMemberDetailClient item={result.data.item} tenant={tenant} />;
}
