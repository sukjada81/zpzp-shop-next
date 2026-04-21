// src/app/(seller)/seller/[tenant]/members/page.tsx
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import SellerMembersClient, {
    type SellerMemberItem,
    type SellerMembersSummary,
} from "@/components/seller/SellerMembersClient";
import SellerNoAccess from "@/components/seller/SellerNoAccess";
import { isAuthError, getInternalOrigin } from "@/lib/seller/fetchSeller";

type MembersResponse = {
    ok: boolean;
    message?: string;
    summary?: SellerMembersSummary;
    items?: SellerMemberItem[];
};

async function fetchSellerMembers(
    tenant: string,
    keyword: string
): Promise<{ ok: boolean; status: number; message?: string; summary?: SellerMembersSummary; items: SellerMemberItem[] }> {
    const origin = getInternalOrigin();
    const url = new URL(`/api/seller/${tenant}/members`, origin);
    if (keyword) url.searchParams.set("q", keyword);

    const store = await cookies();
    const cookie = store
        .getAll()
        .map((item) => `${item.name}=${item.value}`)
        .join("; ");

    try {
        const res = await fetch(url.toString(), {
            cache: "no-store",
            headers: { cookie, "x-tenant-slug": tenant },
        });

        const data = (await res.json().catch(() => null)) as MembersResponse | null;

        return {
            ok: Boolean(res.ok && data?.ok),
            status: res.status,
            message: data?.message,
            summary: data?.summary,
            items: Array.isArray(data?.items) ? data!.items! : [],
        };
    } catch {
        return { ok: false, status: 500, message: "회원 정보를 불러오지 못했습니다.", items: [] };
    }
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

    const result = await fetchSellerMembers(tenant, keyword);

    if (!result.ok) {
        if (isAuthError(result.status)) return <SellerNoAccess tenant={tenant} />;
        notFound();
    }

    const summary: SellerMembersSummary = result.summary ?? {
        totalMembers: 0,
        todaySignups: 0,
        weekSignups: 0,
        todayInflows: 0,
        todayLogins: 0,
        sourceReady: false,
    };

    return (
        <SellerMembersClient
            tenant={tenant}
            items={result.items}
            summary={summary}
            keyword={keyword}
        />
    );
}
