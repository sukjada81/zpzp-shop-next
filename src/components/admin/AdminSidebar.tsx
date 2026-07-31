// src/components/admin/AdminSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminUiStore } from "@/lib/admin/adminUiStore";

// DAD 잔재 메뉴는 삭제하지 않고 주석으로 보존한다(DAD 재사용 가능성).
// 되살리려면 해당 줄의 주석만 해제하면 된다 — 라우트/페이지 파일은 그대로 남아 있다.
const items = [
    { label: "대시보드", href: "/admin/dashboard", icon: "📊" },
    // ✅ FIX: page.tsx 파일 경로가 아니라 실제 페이지 라우트로 이동해야 함
    // [숨김 2026-07-31] 지점 관리 — 줍줍은 링커 기반 운영이고 본사 관리자는 shop-php 가 담당.
    // { label: "지점 관리", href: "/admin/tenant", icon: "🏬" },
    { label: "상품", href: "/admin/products", icon: "🧾" },
    { label: "링커 상품", href: "/admin/linker-products", icon: "🔗" },
    { label: "주문", href: "/admin/orders", icon: "📦" },
    // [숨김 2026-07-31] 포인트 — DAD 전용. 줍줍 라이브 dad_points_ledger 0행(미사용).
    // { label: "포인트", href: "/admin/points", icon: "🪙" },
];

export default function AdminSidebar() {
    const pathname = usePathname();
    const open = useAdminUiStore((s) => s.sidebarOpen);
    const closeSidebar = useAdminUiStore((s) => s.closeSidebar);

    return (
        <>
            {/* mobile overlay */}
            <div
                className={[
                    "fixed inset-0 z-40 bg-black/30 transition-opacity lg:hidden",
                    open ? "opacity-100" : "pointer-events-none opacity-0",
                ].join(" ")}
                onClick={closeSidebar}
            />

            <aside
                className={[
                    "fixed left-0 top-[60px] z-50 h-[calc(100dvh-60px)] w-[290px] p-3 transition-transform lg:static lg:top-0 lg:z-auto lg:h-auto lg:w-auto lg:translate-x-0",
                    open ? "translate-x-0" : "-translate-x-full",
                ].join(" ")}
            >
                <div className="dad-card p-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="text-xs font-semibold text-[var(--dad-muted)]">관리 범위</div>
                            <div className="mt-1 text-sm font-extrabold text-[var(--dad-ink)]">전체 지점</div>
                        </div>
                        <span className="dad-chip">ALL</span>
                    </div>

                    <div className="mt-4 space-y-1">
                        {items.map((it) => {
                            const active = pathname === it.href || pathname.startsWith(it.href + "/");

                            return (
                                <Link
                                    key={it.href}
                                    href={it.href}
                                    onClick={closeSidebar}
                                    className={[
                                        "flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-extrabold transition",
                                        active
                                            ? "bg-[var(--dad-ink)] text-white"
                                            : "text-[var(--dad-ink)] hover:bg-[var(--dad-cream)]",
                                    ].join(" ")}
                                >
                  <span className="flex items-center gap-2">
                    <span>{it.icon}</span>
                      {it.label}
                  </span>
                                    <span className={active ? "opacity-80" : "opacity-30"}>›</span>
                                </Link>
                            );
                        })}
                    </div>

                    <div className="mt-4 rounded-2xl border border-[var(--dad-border)] bg-white/70 p-3">
                        <div className="text-xs font-semibold text-[var(--dad-muted)]">Quick</div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            {/* ✅ Quick도 실제 존재 라우트로 */}
                            {/* [숨김 2026-07-31] 지점 Quick — 지점 관리 메뉴 숨김과 동반
                            <Link className="dad-btn dad-btn-ghost px-3 py-2 text-xs text-center" href="/admin/tenant" onClick={closeSidebar}>
                                지점
                            </Link>
                            */}
                            <Link className="dad-btn dad-btn-ghost px-3 py-2 text-xs text-center" href="/admin/orders" onClick={closeSidebar}>
                                주문
                            </Link>
                            <Link className="dad-btn dad-btn-primary px-3 py-2 text-xs text-center" href="/admin/dashboard" onClick={closeSidebar}>
                                현황
                            </Link>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}