// src/app/(seller)/seller/[tenant]/members/page.tsx
import { notFound } from "next/navigation";
import SellerMembersClient, {
    type SellerMemberItem,
} from "@/components/seller/SellerMembersClient";

function getInternalOrigin() {
    return (
        process.env.NEXT_INTERNAL_ORIGIN ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://127.0.0.1:3000"
    );
}

type MembersResponse = {
    ok: boolean;
    items?: SellerMemberItem[];
};

async function fetchSellerMembers(
    tenant: string
): Promise<SellerMemberItem[]> {
    const origin = getInternalOrigin();
    const url = new URL(`/api/seller/${tenant}/members`, origin);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [];

    const data = (await res.json().catch(() => null)) as MembersResponse | null;
    if (!data?.ok) return [];

    return Array.isArray(data.items) ? data.items : [];
}

export default async function SellerMembersPage({
                                                    params,
                                                    searchParams,
                                                }: {
    params: Promise<{ tenant: string }> | { tenant: string };
    searchParams?: Promise<{ q?: string }> | { q?: string };
}) {
    const resolved = await Promise.resolve(params);
    const resolvedSearch = await Promise.resolve(searchParams);
    const tenant = String(resolved?.tenant ?? "").trim();
    const keyword = String(resolvedSearch?.q ?? "").trim();

    if (!tenant) notFound();

    const items = await fetchSellerMembers(tenant);

    return <SellerMembersClient tenant={tenant} items={items} keyword={keyword} />;
}