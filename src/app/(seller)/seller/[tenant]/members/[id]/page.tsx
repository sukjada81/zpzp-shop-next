// src/app/(seller)/seller/[tenant]/members/page.tsx
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import SellerMembersClient, {
    type SellerMemberItem,
    type SellerMembersSummary,
} from "@/components/seller/SellerMembersClient";

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

type MembersResponse = {
    ok: boolean;
    summary?: SellerMembersSummary;
    items?: SellerMemberItem[];
};

async function fetchSellerMembers(
    tenant: string,
    keyword: string
): Promise<MembersResponse | null> {
    const origin = getInternalOrigin();
    const url = new URL(`/api/seller/${tenant}/members`, origin);

    if (keyword) {
        url.searchParams.set("q", keyword);
    }

    const cookie = await getCookieHeader();

    const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: {
            cookie,
            "x-tenant-slug": tenant,
        },
    });

    if (!res.ok) return null;

    const data = (await res.json().catch(() => null)) as MembersResponse | null;
    if (!data?.ok) return null;

    return data;
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

    const data = await fetchSellerMembers(tenant, keyword);
    if (!data) notFound();

    return (
        <SellerMembersClient
            tenant={tenant}
            items={Array.isArray(data.items) ? data.items : []}
            summary={data.summary}
            keyword={keyword}
        />
    );
}