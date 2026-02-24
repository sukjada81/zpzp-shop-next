// src/app/(admin)/admin/tenants/page.tsx
import { getAdminTenants } from "@/lib/admin/adminApi";

export const dynamic = "force-dynamic";

export default async function AdminTenantsPage() {
    const tenants = await getAdminTenants();

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-lg font-extrabold text-[var(--dad-ink)]">지점(Tenant) 관리</h1>
                    <p className="mt-1 text-sm text-[var(--dad-muted)]">전체 지점 목록 / 상태 확인</p>
                </div>
                <a className="dad-btn dad-btn-primary inline-flex h-10 items-center justify-center px-4 text-sm" href="/admin/dashboard">
                    대시보드 →
                </a>
            </div>

            <div className="dad-card overflow-hidden">
                <div className="border-b border-[var(--dad-border)] px-4 py-3">
                    <div className="text-sm font-extrabold text-[var(--dad-ink)]">Tenants</div>
                </div>

                <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-white">
                        <tr className="text-xs text-[var(--dad-muted)]">
                            <th className="px-4 py-3 text-left font-extrabold">slug</th>
                            <th className="px-4 py-3 text-left font-extrabold">이름</th>
                            <th className="px-4 py-3 text-left font-extrabold">상태</th>
                            <th className="px-4 py-3 text-left font-extrabold">도메인</th>
                            <th className="px-4 py-3 text-left font-extrabold">타임존</th>
                            <th className="px-4 py-3 text-right font-extrabold">바로가기</th>
                        </tr>
                        </thead>
                        <tbody>
                        {tenants.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-[var(--dad-muted)]">
                                    등록된 지점이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            tenants.map((t) => (
                                <tr key={t.slug} className="border-t border-[var(--dad-border)]">
                                    <td className="px-4 py-3 font-mono text-[12px] text-[var(--dad-ink)]">{t.slug}</td>
                                    <td className="px-4 py-3 font-extrabold text-[var(--dad-ink)]">{t.name}</td>
                                    <td className="px-4 py-3">
                                        <span className="dad-chip">{t.status}</span>
                                    </td>
                                    <td className="px-4 py-3 text-[var(--dad-ink)]">{t.primaryDomain ?? "-"}</td>
                                    <td className="px-4 py-3 text-[var(--dad-ink)]">{t.timezone ?? "Asia/Seoul"}</td>
                                    <td className="px-4 py-3 text-right">
                                        <a
                                            className="dad-btn dad-btn-ghost inline-flex h-9 items-center justify-center px-3 text-xs"
                                            href={`/admin/dashboard?tenant=${encodeURIComponent(t.slug)}`}
                                        >
                                            보기 →
                                        </a>
                                    </td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}