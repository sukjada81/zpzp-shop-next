// src/app/(seller)/seller/[tenant]/members/page.tsx
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
    message?: string;
    summary?: SellerMembersSummary;
    items?: SellerMemberItem[];
};

async function fetchSellerMembers(
    tenant: string,
    keyword: string
): Promise<{
    ok: boolean;
    status: number;
    message?: string;
    summary?: SellerMembersSummary;
    items: SellerMemberItem[];
}> {
    const origin = getInternalOrigin();
    const url = new URL(`/api/seller/${tenant}/members`, origin);

    if (keyword) {
        url.searchParams.set("q", keyword);
    }

    const cookie = await getCookieHeader();

    try {
        const res = await fetch(url.toString(), {
            cache: "no-store",
            headers: {
                cookie,
                "x-tenant-slug": tenant,
            },
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
        return {
            ok: false,
            status: 500,
            message: "회원 정보를 불러오지 못했습니다.",
            items: [],
        };
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

    if (!tenant) {
        return (
            <div className="rounded-[28px] border border-red-200 bg-white p-6 text-sm text-red-600 shadow-sm">
                tenant 정보가 없습니다.
            </div>
        );
    }

    const result = await fetchSellerMembers(tenant, keyword);

    // 404 대신 페이지는 띄우고 빈 상태/안내 문구로 처리
    const summary: SellerMembersSummary = result.summary ?? {
        totalMembers: 0,
        todaySignups: 0,
        weekSignups: 0,
        todayInflows: 0,
        todayLogins: 0,
        sourceReady: false,
    };

    const items = Array.isArray(result.items) ? result.items : [];

    return (
        <div className="space-y-4">
            {!result.ok ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    {result.status === 401 || result.status === 403
                        ? "회원 목록 조회 권한이 없거나 로그인 정보가 전달되지 않았습니다."
                        : result.message || "회원 정보를 불러오지 못했습니다."}
                </div>
            ) : null}

            <SellerMembersClient
                tenant={tenant}
                items={items}
                summary={summary}
                keyword={keyword}
            />
        </div>
    );
}