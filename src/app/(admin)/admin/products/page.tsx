// src/app/(admin)/admin/products/page.tsx
import { getAdminProducts, getAdminTenants } from "@/lib/admin/adminApi";
import ProductFilters from "@/components/admin/products/ProductFilters";
import ProductTable from "@/components/admin/products/ProductTable";

// 응답 형태가 rows/items 등으로 달라도 안전하게 사용하기 위한 정규화
function normalizeList<T>(list: any): {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
} {
    const items: T[] = (list?.rows ?? list?.items ?? list?.data ?? []) as T[];
    const total = Number(list?.total ?? list?.count ?? items.length ?? 0) || 0;
    const page = Number(list?.page ?? 1) || 1;
    const pageSize = Number(list?.limit ?? list?.pageSize ?? list?.perPage ?? 20) || 20;

    return { items, total, page, pageSize };
}

type SP = Record<string, string | string[] | undefined>;

// ✅ Next 16에서 searchParams가 Promise로 들어오는 케이스 방어
async function resolveSearchParams(searchParams: unknown): Promise<SP> {
    const sp = (await Promise.resolve(searchParams)) as SP | undefined;
    return sp ?? {};
}

export default async function AdminProductsPage({
                                                    searchParams,
                                                }: {
    // ✅ Promise 가능성을 타입에 포함
    searchParams?: Promise<SP> | SP;
}) {
    const sp = await resolveSearchParams(searchParams);

    const tenant = typeof sp.tenant === "string" ? sp.tenant : "all";
    const status = typeof sp.status === "string" ? sp.status : "";
    const q = typeof sp.q === "string" ? sp.q : "";
    const page = typeof sp.page === "string" ? sp.page : "1";

    const [tenants, rawList] = await Promise.all([
        getAdminTenants(),
        getAdminProducts({
            tenant,
            status: status || undefined,
            q: q || undefined,
            page,
            pageSize: "20",
        }),
    ]);

    const list = normalizeList<any>(rawList);
    const pageCount = Math.max(1, Math.ceil(list.total / list.pageSize));

    const prevPage = Math.max(1, list.page - 1);
    const nextPage = Math.min(pageCount, list.page + 1);

    return (
        <main className="mx-auto w-full max-w-[1440px] px-3 pb-10 pt-6 sm:px-4">
            <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                    <div className="text-xl font-extrabold text-[var(--dad-ink)]">상품 관리</div>
                    <div className="mt-1 text-sm text-[var(--dad-muted)]">
                        지점별 상품을 조회/등록합니다. (통합 관리자)
                    </div>
                </div>

                <a href="/admin/products/new" className="dad-btn dad-btn-primary h-10 px-4 text-sm">
                    + 상품 등록
                </a>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
                <div className="dad-card p-4">
                    <div className="text-sm font-extrabold text-[var(--dad-ink)]">필터</div>
                    <div className="mt-3">
                        <ProductFilters tenants={tenants} />
                    </div>
                </div>

                <div className="dad-card overflow-hidden p-0">
                    <div className="flex items-center justify-between border-b border-[var(--dad-border)] px-4 py-3">
                        <div className="text-sm font-extrabold text-[var(--dad-ink)]">
                            목록 <span className="text-[var(--dad-muted)]">({list.total})</span>
                        </div>
                    </div>

                    <ProductTable rows={list.items} />

                    <div className="flex items-center justify-between border-t border-[var(--dad-border)] px-4 py-3 text-sm">
                        <div className="text-[var(--dad-muted)]">
                            page {list.page} / {pageCount}
                        </div>
                        <div className="flex gap-2">
                            <a
                                className="dad-btn dad-btn-ghost h-9 px-3 text-sm"
                                href={`/admin/products?tenant=${encodeURIComponent(tenant)}&status=${encodeURIComponent(
                                    status
                                )}&q=${encodeURIComponent(q)}&page=${prevPage}`}
                            >
                                이전
                            </a>
                            <a
                                className="dad-btn dad-btn-ghost h-9 px-3 text-sm"
                                href={`/admin/products?tenant=${encodeURIComponent(tenant)}&status=${encodeURIComponent(
                                    status
                                )}&q=${encodeURIComponent(q)}&page=${nextPage}`}
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