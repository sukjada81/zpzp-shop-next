// src/app/(admin)/admin/points/page.tsx
import { getAdminPoints, getAdminTenants } from "@/lib/admin/adminApi";

export const dynamic = "force-dynamic";

export default async function AdminPointsPage({
                                                  searchParams,
                                              }: {
    searchParams: { tenant?: string; q?: string; type?: string; page?: string; pageSize?: string };
}) {
    const tenant = (searchParams.tenant ?? "all").trim();
    const q = (searchParams.q ?? "").trim();
    const type = (searchParams.type ?? "").trim();
    const page = (searchParams.page ?? "1").trim();
    const pageSize = (searchParams.pageSize ?? "20").trim();

    const [tenants, list] = await Promise.all([
        getAdminTenants(),
        getAdminPoints({ tenant, q, type, page, pageSize }),
    ]);

    const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
    const current = Math.min(Number(list.page), totalPages);

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-lg font-extrabold text-[var(--dad-ink)]">포인트 원장</h1>
                    <p className="mt-1 text-sm text-[var(--dad-muted)]">dad_points_ledger 통합 조회</p>
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

                <span className="dad-chip">Type</span>
                <input
                    name="type"
                    defaultValue={type}
                    placeholder="예: earn/use/adjust"
                    className="h-10 flex-1 rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)]"
                />

                <span className="dad-chip">Search</span>
                <input
                    name="q"
                    defaultValue={q}
                    placeholder="reason/type 검색"
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
                        Points <span className="text-[var(--dad-muted)]">({list.total.toLocaleString()})</span>
                    </div>
                    <div className="dad-chip">Page {current} / {totalPages}</div>
                </div>

                <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-white">
                        <tr className="text-xs text-[var(--dad-muted)]">
                            <th className="px-4 py-3 text-left font-extrabold">지점</th>
                            <th className="px-4 py-3 text-left font-extrabold">타입</th>
                            <th className="px-4 py-3 text-right font-extrabold">증감</th>
                            <th className="px-4 py-3 text-right font-extrabold">잔액</th>
                            <th className="px-4 py-3 text-left font-extrabold">사유</th>
                            <th className="px-4 py-3 text-left font-extrabold">주문ID</th>
                            <th className="px-4 py-3 text-left font-extrabold">일시</th>
                        </tr>
                        </thead>
                        <tbody>
                        {list.items.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-[var(--dad-muted)]">
                                    결과가 없습니다.
                                </td>
                            </tr>
                        ) : (
                            list.items.map((p) => (
                                <tr key={p.id} className="border-t border-[var(--dad-border)]">
                                    <td className="px-4 py-3">
                                        {p.tenant ? <span className="dad-chip">{p.tenant.name} / {p.tenant.slug}</span> : "-"}
                                    </td>
                                    <td className="px-4 py-3"><span className="dad-chip">{p.type}</span></td>
                                    <td className="px-4 py-3 text-right font-extrabold tabular-nums text-[var(--dad-ink)]">
                                        {Number(p.amount).toLocaleString()}P
                                    </td>
                                    <td className="px-4 py-3 text-right font-extrabold tabular-nums text-[var(--dad-ink)]">
                                        {p.balanceAfter == null ? "-" : `${Number(p.balanceAfter).toLocaleString()}P`}
                                    </td>
                                    <td className="px-4 py-3 text-[var(--dad-ink)]">{p.reason ?? "-"}</td>
                                    <td className="px-4 py-3 font-mono text-[12px] text-[var(--dad-muted)]">{p.orderId ?? "-"}</td>
                                    <td className="px-4 py-3 text-[var(--dad-muted)]">{new Date(p.createdAt).toLocaleString()}</td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>

                <Pager baseHref="/admin/points" tenant={tenant} q={q} type={type} page={current} totalPages={totalPages} pageSize={pageSize} />
            </div>
        </div>
    );
}

function Pager({
                   baseHref,
                   tenant,
                   q,
                   type,
                   page,
                   totalPages,
                   pageSize,
               }: {
    baseHref: string;
    tenant: string;
    q: string;
    type: string;
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
        if (type) sp.set("type", type);
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
                오케이
            </div>
            <a className="dad-btn dad-btn-primary px-3 py-2 text-xs" href={mk(next)}>
                다음 →
            </a>
        </div>
    );
}