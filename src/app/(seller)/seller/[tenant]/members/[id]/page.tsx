// src/app/(seller)/seller/[tenant]/members/[id]/page.tsx
import { notFound } from "next/navigation";
import SellerMemberDetailClient, {
    type SellerMemberDetail,
} from "@/components/seller/SellerMemberDetailClient";

function getInternalOrigin() {
    return (
        process.env.NEXT_INTERNAL_ORIGIN ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://127.0.0.1:3000"
    );
}

type MemberDetailResponse = {
    ok: boolean;
    item?: SellerMemberDetail;
};

async function fetchSellerMemberDetail(
    tenant: string,
    id: string
): Promise<SellerMemberDetail | null> {
    const origin = getInternalOrigin();
    const url = new URL(`/api/seller/${tenant}/members/${id}`, origin);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;

    const data = (await res.json().catch(() => null)) as MemberDetailResponse | null;
    if (!data?.ok || !data.item) return null;

    return data.item;
}

export default async function SellerMemberDetailPage({
                                                         params,
                                                     }: {
    params:
        | Promise<{ tenant: string; id: string }>
        | { tenant: string; id: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = String(resolved?.tenant ?? "").trim();
    const id = String(resolved?.id ?? "").trim();

    if (!tenant || !id) notFound();

    const item = await fetchSellerMemberDetail(tenant, id);
    if (!item) notFound();

    return <SellerMemberDetailClient item={item} />;
}