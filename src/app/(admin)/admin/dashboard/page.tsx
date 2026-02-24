// src/app/(admin)/admin/dashboard/page.tsx
import { getAdminDashboard, getAdminTenants } from "@/lib/admin/adminApi";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
                                                     searchParams,
                                                 }: {
    searchParams: { tenant?: string };
}) {
    const tenant = (searchParams.tenant ?? "all").trim();

    try {
        const [tenants, dashboard] = await Promise.all([
            getAdminTenants(),
            getAdminDashboard(tenant),
        ]);

        return (
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-lg font-extrabold text-[var(--dad-ink)]">
                            통합 관리자 대시보드
                        </h1>
                        <p className="mt-1 text-sm text-[var(--dad-muted)]">
                            지점별 데이터를 한 화면에서 관리합니다.
                        </p>
                    </div>

                    <form className="dad-card flex items-center gap-2 px-3 py-2">
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
                        <button className="dad-btn dad-btn-primary h-10 px-4 text-sm" type="submit">
                            적용
                        </button>
                    </form>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Kpi title="오늘 주문" value={dashboard.kpi.todayOrders} />
                    <Kpi title="오늘 매출" value={dashboard.kpi.todaySales} suffix="원" />
                    <Kpi title="미결제" value={dashboard.kpi.unpaid} />
                    <Kpi title="결제완료" value={dashboard.kpi.paid} />
                    <Kpi title="픽업예정" value={dashboard.kpi.pickupsUpcoming} />
                    <Kpi title="포인트 사용" value={dashboard.kpi.pointUsed} suffix="P" />
                </div>

                <div className="dad-card overflow-hidden">
                    <div className="flex items-center justify-between border-b border-[var(--dad-border)] px-4 py-3">
                        <div className="text-sm font-extrabold text-[var(--dad-ink)]">최근 주문</div>
                        <a
                            href={`/admin/orders?tenant=${encodeURIComponent(tenant)}`}
                            className="dad-btn dad-btn-ghost px-3 py-1.5 text-xs"
                        >
                            주문관리 →
                        </a>
                    </div>

                    <div className="overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-white">
                            <tr className="text-xs text-[var(--dad-muted)]">
                                <th className="px-4 py-3 text-left font-extrabold">지점</th>
                                <th className="px-4 py-3 text-left font-extrabold">주문번호</th>
                                <th className="px-4 py-3 text-left font-extrabold">구매자</th>
                                <th className="px-4 py-3 text-right font-extrabold">금액</th>
                                <th className="px-4 py-3 text-left font-extrabold">상태</th>
                                <th className="px-4 py-3 text-left font-extrabold">픽업</th>
                            </tr>
                            </thead>
                            <tbody>
                            {dashboard.recentOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-[var(--dad-muted)]">
                                        최근 주문이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                dashboard.recentOrders.map((r) => (
                                    <tr key={r.orderNo} className="border-t border-[var(--dad-border)]">
                                        <td className="px-4 py-3">
                                            {r.tenant ? (
                                                <span className="dad-chip">
                            {r.tenant.name} / {r.tenant.slug}
                          </span>
                                            ) : (
                                                <span className="text-[var(--dad-muted)]">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-[12px] text-[var(--dad-ink)]">
                                            {r.orderNo}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-extrabold text-[var(--dad-ink)]">{r.buyerName}</div>
                                            <div className="text-xs text-[var(--dad-muted)]">{r.buyerPhone}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-extrabold tabular-nums text-[var(--dad-ink)]">
                                            {Number(r.totalAmount).toLocaleString()}원
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="dad-chip">{r.status}</span>
                                        </td>
                                        <td className="px-4 py-3 text-[var(--dad-ink)]">{r.pickupAt ?? "-"}</td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    } catch (e: any) {
        return (
            <div className="space-y-4">
                <div>
                    <h1 className="text-lg font-extrabold text-[var(--dad-ink)]">통합 관리자 대시보드</h1>
                    <p className="mt-1 text-sm text-[var(--dad-muted)]">
                        디자인은 적용되었고, 데이터 연결만 확인하면 됩니다.
                    </p>
                </div>

                <div className="dad-card p-4">
                    <div className="text-sm font-extrabold text-[var(--dad-ink)]">데이터를 불러올 수 없습니다</div>
                    <p className="mt-2 text-sm text-[var(--dad-muted)]">
                        API 서버 실행/프록시 연결을 확인하세요.
                    </p>
                    <div className="mt-3 rounded-2xl border border-[var(--dad-border)] bg-white/70 p-3 text-xs">
                        <div className="font-extrabold text-[var(--dad-ink)]">에러</div>
                        <pre className="mt-2 whitespace-pre-wrap text-[var(--dad-ink)]">
{String(e?.message ?? e)}
            </pre>
                    </div>
                </div>
            </div>
        );
    }
}

function Kpi({ title, value, suffix }: { title: string; value: number; suffix?: string }) {
    return (
        <div className="dad-card p-4">
            <div className="text-xs font-extrabold text-[var(--dad-muted)]">{title}</div>
            <div className="mt-1 text-xl font-extrabold text-[var(--dad-ink)] tabular-nums">
                {Number(value).toLocaleString()}
                {suffix ?? ""}
            </div>
            <div className="mt-2 h-1 w-full rounded-full bg-[var(--dad-cream)]">
                <div className="h-1 w-1/3 rounded-full bg-[var(--dad-orange)]" />
            </div>
        </div>
    );
}