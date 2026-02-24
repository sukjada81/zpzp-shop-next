// src/app/(admin)/admin/products/page.tsx
import { getAdminProducts, getAdminTenants } from "@/lib/admin/adminApi";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
                                                    searchParams,
                                                }: {
    searchParams: { tenant?: string; q?: string; status?: string; page?: string; pageSize?: string };
}) {
    const tenant = (searchParams.tenant ?? "all").trim();
    const q = (searchParams.q ?? "").trim();
    const status = (searchParams.status ?? "").trim();
    const page = (searchParams.page ?? "1").trim();
    const pageSize = (searchParams.pageSize ?? "20").trim();

    const [tenants, list] = await Promise.all([
        getAdminTenants(),
        getAdminProducts({ tenant, q, status, page, pageSize }),
    ]);

    const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
    const current = Math.min(Number(list.page), totalPages);

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-lg font-extrabold text-[var(--dad-ink)]">상품 관리</h1>
                    <p className="mt-1 text-sm text-[var(--dad-muted)]">전체 tenant 상품을 통합 조회합니다.</p>
                </div>

                <a href="/admin/dashboard" className="dad-btn dad-btn-ghost inline-flex h-10 items-center justify-center px-4 text-sm">
                    대시보드 →
                </a>
            </div>

            <form className="dad-card flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <span className="dad-chip">Tenant</span>
                <select
                    name="tenant"
                    defaultValue={tenant}
                    className="h-10 rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)]"
                >
                    <option value="all">전체</option>
                    {tenants.map((t) => (
                        <option key={t.slug} value={t.slug}>
                            {t.name} ({t.slug})
                        </option>
                    ))}
                </select>

                <span className="dad-chip">Status</span>
                <input
                    name="status"
                    defaultValue={status}
                    placeholder="예: draft/active/soldout"
                    className="h-10 flex-1 rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)]"
                />

                <span className="dad-chip">Search</span>
                <input
                    name="q"
                    defaultValue={q}
                    placeholder="상품명 검색"
                    className="h-10 flex-1 rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)]"
                />

                <input type="hidden" name="page" value="1" />
                <input type="hidden" name="pageSize" value={pageSize} />

                <button className="dad-btn dad-btn-primary h-10 px-4 text-sm" type="submit">
                    적용
                </button>
            </form>

            <div className="dad-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--dad-border)] px-4 py-3">
                    <div className="text-sm font-extrabold text-[var(--dad-ink)]">
                        Products <span className="text-[var(--dad-muted)]">({list.total.toLocaleString()})</span>
                    </div>
                    <div className="dad-chip">
                        Page {current} / {totalPages}
                    </div>
                </div>

                <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-white">
                        <tr className="text-xs text-[var(--dad-muted)]">
                            <th className="px-4 py-3 text-left font-extrabold">지점</th>
                            <th className="px-4 py-3 text-left font-extrabold">상품</th>
                            <th className="px-4 py-3 text-left font-extrabold">상태</th>
                            <th className="px-4 py-3 text-right font-extrabold">가격</th>
                            <th className="px-4 py-3 text-left font-extrabold">픽업</th>
                            <th className="px-4 py-3 text-left font-extrabold">업데이트</th>
                        </tr>
                        </thead>
                        <tbody>
                        {list.items.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-[var(--dad-muted)]">
                                    결과가 없습니다.
                                </td>
                            </tr>
                        ) : (
                            list.items.map((p) => (
                                <tr key={p.id} className="border-t border-[var(--dad-border)]">
                                    <td className="px-4 py-3">
                                        {p.tenant ? <span className="dad-chip">{p.tenant.name} / {p.tenant.slug}</span> : "-"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-extrabold text-[var(--dad-ink)]">{p.title}</div>
                                        <div className="text-xs text-[var(--dad-muted)] font-mono">#{p.id}</div>
                                    </td>
                                    <td className="px-4 py-3"><span className="dad-chip">{p.status}</span></td>
                                    <td className="px-4 py-3 text-right font-extrabold tabular-nums text-[var(--dad-ink)]">
                                        {Number(p.basePrice).toLocaleString()}원
                                    </td>
                                    <td className="px-4 py-3 text-[var(--dad-ink)]">{p.pickupOnly ? "pickup_only" : "shipping"}</td>
                                    <td className="px-4 py-3 text-[var(--dad-muted)]">{new Date(p.updatedAt).toLocaleString()}</td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>

                <Pager
                    baseHref="/admin/products"
                    tenant={tenant}
                    q={q}
                    status={status}
                    page={current}
                    totalPages={totalPages}
                    pageSize={pageSize}
                />
            </div>
        </div>
    );
}

function Pager({
                   baseHref,
                   tenant,
                   q,
                   status,
                   page,
                   totalPages,
                   pageSize,
               }: {
    baseHref: string;
    tenant: string;
    q: string;
    status: string;
    page: number;
    totalPages: number;
    pageSize: string;
}) {
    const prev = Math.max(1, page - 1);
    const next = Math.min(totalPages, page + 1);

    const mk = (p: number) => {
        const sp = new URLSearchParams();
        sp.set("tenant", tenant);
        if (q) sp.set("q", q);
        if (status) sp.set("status", status);
        sp.set("page", String(p));
        sp.set("pageSize", pageSize);
        return `${baseHref}?${sp.toString()}`;
    };

    return (
        <div className="flex items-center justify-between border-t border-[var(--dad-border)] px-4 py-3">
            <a className="dad-btn dad-btn-ghost px-3 py-2 text-xs" href={mk(prev)}>
                ← 이전
            </a>
            <div className="text-xs font-bold text-[var(--dad-muted)]">
                {page} / {totalPages}
            </div>
            <a className="dad-btn dad-btn-primary px-3 py-2 text-xs" href={mk(next)}>
                다음 →
            </a>
        </div>
    );
}