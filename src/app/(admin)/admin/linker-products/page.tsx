import LinkerProductStatsTable, { type LinkerStatsRow } from "@/components/admin/linker-products/LinkerProductStatsTable";
import { headers } from "next/headers";

type SP = Record<string, string | string[] | undefined>;

async function resolveSearchParams(searchParams: unknown): Promise<SP> {
    const sp = (await Promise.resolve(searchParams)) as SP | undefined;
    return sp ?? {};
}

async function getLinkerStats(q: string, page: string) {
    const baseUrl =
        process.env.NEXT_INTERNAL_ORIGIN ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://127.0.0.1:3000";
    const url = new URL("/api/admin/linker-products/linkers", baseUrl);
    if (q) url.searchParams.set("q", q);
    url.searchParams.set("page", page);
    url.searchParams.set("pageSize", "20");

    const cookie = (await headers()).get("cookie") ?? "";
    const res = await fetch(url.toString(), {
        headers: { cookie, accept: "application/json" },
        cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
        return { items: [] as LinkerStatsRow[], total: 0, page: 1, pageSize: 20 };
    }
    return {
        items: (data.items ?? []) as LinkerStatsRow[],
        total: Number(data.total ?? 0),
        page: Number(data.page ?? 1),
        pageSize: Number(data.pageSize ?? 20),
    };
}

export default async function AdminLinkerProductsPage({
    searchParams,
}: {
    searchParams?: Promise<SP> | SP;
}) {
    const sp = await resolveSearchParams(searchParams);
    const q = typeof sp.q === "string" ? sp.q : "";
    const page = typeof sp.page === "string" ? sp.page : "1";
    const list = await getLinkerStats(q, page);
    const pageCount = Math.max(1, Math.ceil(list.total / list.pageSize));
    const prevPage = Math.max(1, list.page - 1);
    const nextPage = Math.min(pageCount, list.page + 1);

    return (
        <main className="mx-auto w-full max-w-[1600px] px-3 pb-10 pt-6 sm:px-4">
            <div className="mb-4">
                <div className="text-xl font-extrabold text-[var(--dad-ink)]">링커 상품 통계</div>
                <div className="mt-1 text-sm text-[var(--dad-muted)]">
                    링커별 등록 상품 수를 확인하고, 숫자를 클릭하면 판매 중인 상품 목록을 볼 수 있습니다.
                </div>
            </div>

            <div className="space-y-4">
                <div className="dad-card p-4">
                    <form className="flex flex-col gap-2 sm:flex-row">
                        <input
                            name="q"
                            defaultValue={q}
                            placeholder="링커 ID 또는 샵 이름 검색"
                            className="min-w-0 flex-1 rounded-xl border border-[var(--dad-border)] px-4 py-3 text-sm outline-none"
                        />
                        <button type="submit" className="dad-btn dad-btn-primary h-11 px-4 text-sm">
                            검색
                        </button>
                    </form>
                </div>

                <div className="dad-card p-0">
                    <div className="flex items-center justify-between border-b border-[var(--dad-border)] px-4 py-3">
                        <div className="text-sm font-extrabold text-[var(--dad-ink)]">
                            링커 목록 <span className="text-[var(--dad-muted)]">({list.total})</span>
                        </div>
                        <div className="text-xs text-[var(--dad-muted)]">
                            등록 상품 = 선택됨 · 스토어 노출 = 진열+판매중
                        </div>
                    </div>

                    <LinkerProductStatsTable rows={list.items} />

                    <div className="flex items-center justify-between border-t border-[var(--dad-border)] px-4 py-3 text-sm">
                        <div className="text-[var(--dad-muted)]">
                            page {list.page} / {pageCount}
                        </div>
                        <div className="flex gap-2">
                            <a
                                className="dad-btn dad-btn-ghost h-9 px-3 text-sm"
                                href={`/admin/linker-products?q=${encodeURIComponent(q)}&page=${prevPage}`}
                            >
                                이전
                            </a>
                            <a
                                className="dad-btn dad-btn-ghost h-9 px-3 text-sm"
                                href={`/admin/linker-products?q=${encodeURIComponent(q)}&page=${nextPage}`}
                            >
                                다음
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
