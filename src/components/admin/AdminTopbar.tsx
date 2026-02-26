// src/components/admin/AdminTopbar.tsx
"use client";

import { useAdminUiStore } from "@/lib/admin/adminUiStore";

export default function AdminTopbar() {
    const toggleSidebar = useAdminUiStore((s) => s.toggleSidebar);

    return (
        <header className="sticky top-0 z-40 border-b border-[var(--dad-border)] bg-white/80 backdrop-blur">
            <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-3 py-3 sm:px-4">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={toggleSidebar}
                        className="dad-btn dad-btn-ghost inline-flex h-10 w-10 items-center justify-center lg:hidden"
                        aria-label="사이드바 열기"
                    >
                        ☰
                    </button>

                    <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--dad-orange)] text-white shadow">
                            😊
                        </div>
                        <div className="leading-tight">
                            <div className="text-sm font-extrabold text-[var(--dad-ink)]">
                                디스카운트 올데이 <span className="text-[var(--dad-orange)]">Admin</span>
                            </div>
                            <div className="text-xs text-[var(--dad-muted)]">통합 대시보드 / 전체 지점 관리</div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <a href="/admin/dashboard" className="dad-chip">
                        Dashboard
                    </a>
                    <a href="/admin/tenants" className="dad-chip">
                        Tenants
                    </a>
                    <a href="/admin/login" className="dad-btn dad-btn-ghost px-3 py-2 text-sm">
                        로그아웃
                    </a>
                </div>
            </div>
        </header>
    );
}