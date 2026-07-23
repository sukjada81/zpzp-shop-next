// src/components/seller/SellerShell.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    ShoppingBag,
    Users,
    BarChart3,
    LogIn,
    LogOut,
    Menu,
    X,
    ShieldCheck,
    ChevronsUpDown,
    Building2,
    PackageCheck,
} from "lucide-react";
import { useEffect, useState } from "react";

type SessionResponse = {
    ok?: boolean;
    loggedIn?: boolean;
    member?: {
        uid?: number | string;
        id?: string;
        name?: string;
        email?: string;
        phone?: string;
        tenantSlug?: string;
    } | null;
    tenant?: string;
};

type TenantItem = {
    id: number;
    slug: string;
    name: string;
};

function NavItem({
    href,
    label,
    icon: Icon,
    active,
    onClick,
    highlight,
}: {
    href: string;
    label: string;
    icon: any;
    active: boolean;
    onClick?: () => void;
    highlight?: boolean;
}) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className={[
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                active
                    ? "bg-blue-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.28)]"
                    : highlight
                      ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100"
                      : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
            ].join(" ")}
        >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
        </Link>
    );
}

export default function SellerShell({
    tenant,
    isAdmin = false,
    isSuperAdmin = false,
    role = "",
    children,
}: {
    tenant: string;
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
    role?: string;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [session, setSession] = useState<SessionResponse | null>(null);
    const [sessionLoading, setSessionLoading] = useState(true);
    const [logoutLoading, setLogoutLoading] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [tenants, setTenants] = useState<TenantItem[]>([]);
    const [tenantSwitcherOpen, setTenantSwitcherOpen] = useState(false);

    const dashboardHref = `/${tenant}`;
    const salesHref = `/${tenant}/sales`;
    const ordersHref = `/${tenant}/orders`;
    const membersHref = `/${tenant}/members`;
    const productsHref = `/${tenant}/products`;
    const applicationsHref = `/${tenant}/applications`;
    const tenantsHref = `/${tenant}/tenants`;

    const isDashboardActive = pathname === `/${tenant}` || pathname === `/seller/${tenant}`;
    const isSalesActive =
        pathname.startsWith(`/${tenant}/sales`) ||
        pathname.startsWith(`/seller/${tenant}/sales`);
    const isOrdersActive =
        pathname.startsWith(`/${tenant}/orders`) ||
        pathname.startsWith(`/seller/${tenant}/orders`);
    const isMembersActive =
        pathname.startsWith(`/${tenant}/members`) ||
        pathname.startsWith(`/seller/${tenant}/members`);
    const isProductsActive =
        pathname.startsWith(`/${tenant}/products`) ||
        pathname.startsWith(`/seller/${tenant}/products`);
    const isApplicationsActive =
        pathname.startsWith(`/${tenant}/applications`) ||
        pathname.startsWith(`/seller/${tenant}/applications`);
    const isTenantsActive =
        pathname === tenantsHref || pathname.startsWith(`${tenantsHref}/`);

    useEffect(() => {
        let alive = true;

        async function loadSession() {
            try {
                setSessionLoading(true);
                const res = await fetch("/auth/session", {
                    method: "GET",
                    cache: "no-store",
                    credentials: "include",
                    headers: { accept: "application/json" },
                });
                const data = (await res.json().catch(() => null)) as SessionResponse | null;
                if (!alive) return;
                setSession(data);
            } catch {
                if (!alive) return;
                setSession(null);
            } finally {
                if (!alive) return;
                setSessionLoading(false);
            }
        }

        loadSession();
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        if (!isSuperAdmin) return;
        let alive = true;

        async function loadTenants() {
            try {
                const slugForApi = tenant === "__all__" ? "__all__" : tenant;
                const res = await fetch(`/api/seller/${slugForApi}/tenants`, {
                    method: "GET",
                    cache: "no-store",
                    credentials: "include",
                    headers: { accept: "application/json" },
                });
                const data = await res.json().catch(() => null);
                if (!alive) return;
                if (data?.ok && Array.isArray(data.items)) {
                    setTenants(data.items);
                }
            } catch {
                // 조용히 무시 — 스위처가 비어있으면 렌더 안 됨
            }
        }

        loadTenants();
        return () => { alive = false; };
    }, [isSuperAdmin, tenant]);

    useEffect(() => {
        setMobileMenuOpen(false);
        setTenantSwitcherOpen(false);
    }, [pathname]);

    const sellerOrigin = String(process.env.SELLER_ORIGIN || "").replace(/\/+$/, "");
    const returnTo = sellerOrigin ? `${sellerOrigin}/${tenant}` : `/${tenant}`;
    const loginHref = `/auth/kakao/login?tenant=${encodeURIComponent(tenant)}&returnTo=${encodeURIComponent(returnTo)}`;

    async function handleLogout() {
        try {
            setLogoutLoading(true);
            await fetch("/auth/logout?tenant=" + encodeURIComponent(tenant), {
                method: "POST",
                credentials: "include",
            });
        } finally {
            const target =
                typeof window !== "undefined"
                    ? `${window.location.origin}/${tenant}`
                    : `/${tenant}`;
            window.location.href = target;
        }
    }

    function handleTenantSwitch(slug: string) {
        setTenantSwitcherOpen(false);
        router.push(`/${slug}`);
    }

    const memberName = session?.member?.name?.trim() || "회원";
    const loggedIn = Boolean(session?.loggedIn && session?.member?.uid);

    function closeMobileMenu() {
        setMobileMenuOpen(false);
    }

    const currentTenantLabel = tenant === "__all__" ? "전체 지점" : tenant;
    const isLinker = role === "linker";

    const tenantSwitcher =
        isSuperAdmin ? (
            <div className="relative mb-4">
                <button
                    type="button"
                    onClick={() => setTenantSwitcherOpen((v) => !v)}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                >
                    <span className="flex items-center gap-2 truncate">
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                        <span className="truncate">{currentTenantLabel}</span>
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
                </button>

                {tenantSwitcherOpen ? (
                    <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-2xl border border-slate-200 bg-white py-1 shadow-lg">
                        <button
                            key="__all__"
                            type="button"
                            onClick={() => handleTenantSwitch("__all__")}
                            className={[
                                "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition",
                                tenant === "__all__"
                                    ? "bg-violet-50 font-semibold text-violet-700"
                                    : "text-slate-700 hover:bg-slate-50",
                            ].join(" ")}
                        >
                            <span className="font-medium">전체 지점</span>
                            <span className="text-xs text-slate-400">(all)</span>
                        </button>
                        {tenants.map((t) => (
                            <button
                                key={t.slug}
                                type="button"
                                onClick={() => handleTenantSwitch(t.slug)}
                                className={[
                                    "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition",
                                    t.slug === tenant
                                        ? "bg-violet-50 font-semibold text-violet-700"
                                        : "text-slate-700 hover:bg-slate-50",
                                ].join(" ")}
                            >
                                <span className="font-medium">{t.name}</span>
                                <span className="text-xs text-slate-400">({t.slug})</span>
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
        ) : null;

    const menuContent = (
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="mb-5">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {isLinker ? "Linker Console" : "Seller Console"}
                </div>
                <div className="mt-2 break-words text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                    {tenant === "__all__" ? "전체 지점" : tenant}
                </div>
                <div className="mt-2 text-sm text-slate-500">
                    {isLinker ? "내 줍줍샵 상품과 슬롯 관리" : "지점 운영 / 주문 / 회원 / 매출 통계"}
                </div>
                {isAdmin ? (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                        <ShieldCheck className="h-3 w-3" />
                        관리자
                    </div>
                ) : null}
            </div>

            {tenantSwitcher}

            <div className="space-y-2">
                {!isLinker ? <NavItem
                    href={dashboardHref}
                    label="대시보드"
                    icon={LayoutDashboard}
                    active={isDashboardActive}
                    onClick={closeMobileMenu}
                /> : null}
                {!isLinker ? <NavItem
                    href={salesHref}
                    label="매출통계"
                    icon={BarChart3}
                    active={isSalesActive}
                    onClick={closeMobileMenu}
                /> : null}
                {!isLinker ? <NavItem
                    href={ordersHref}
                    label="주문관리"
                    icon={ShoppingBag}
                    active={isOrdersActive}
                    onClick={closeMobileMenu}
                /> : null}
                {!isLinker ? <NavItem
                    href={membersHref}
                    label="회원관리"
                    icon={Users}
                    active={isMembersActive}
                    onClick={closeMobileMenu}
                /> : null}
                {isLinker ? <NavItem
                    href={productsHref}
                    label="상품관리"
                    icon={PackageCheck}
                    active={isProductsActive}
                    onClick={closeMobileMenu}
                /> : null}
                {isSuperAdmin ? (
                    <NavItem
                        href={applicationsHref}
                        label="셀러 승인 관리"
                        icon={ShieldCheck}
                        active={isApplicationsActive}
                        onClick={closeMobileMenu}
                        highlight={!isApplicationsActive}
                    />
                ) : null}
                {isSuperAdmin ? (
                    <NavItem
                        href={tenantsHref}
                        label="지점 관리"
                        icon={Building2}
                        active={isTenantsActive}
                        onClick={closeMobileMenu}
                        highlight={!isTenantsActive}
                    />
                ) : null}
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-400">로그인 상태</div>
                {sessionLoading ? (
                    <div className="mt-2 text-sm text-slate-500">불러오는 중...</div>
                ) : loggedIn ? (
                    <>
                        <div className="mt-2 text-sm font-semibold text-slate-900">
                            {memberName}
                        </div>
                        <div className="mt-1 break-all text-xs text-slate-500">
                            {session?.member?.email || session?.member?.id || "-"}
                        </div>
                    </>
                ) : (
                    <div className="mt-2 text-sm text-slate-500">로그인이 필요합니다.</div>
                )}
            </div>

            <div className="mt-4">
                {loggedIn ? (
                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={logoutLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                    >
                        <LogOut className="h-4 w-4" />
                        {logoutLoading ? "로그아웃 중..." : "로그아웃"}
                    </button>
                ) : (
                    <Link
                        href={loginHref}
                        onClick={closeMobileMenu}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                        <LogIn className="h-4 w-4" />
                        카카오 로그인
                    </Link>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#EEF2F8]">
            <div className="mx-auto w-full max-w-[1280px] px-4 py-4 md:hidden">
                <div className="mb-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Seller Console
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                                <span className="truncate text-xl font-extrabold tracking-[-0.04em] text-slate-900">
                                    {tenant === "__all__" ? "전체 지점" : tenant}
                                </span>
                                {isAdmin ? (
                                    <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                                        관리자
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(true)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                            aria-label="메뉴 열기"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            {mobileMenuOpen ? (
                <div className="fixed inset-0 z-50 md:hidden">
                    <button
                        type="button"
                        aria-label="메뉴 닫기"
                        onClick={closeMobileMenu}
                        className="absolute inset-0 bg-slate-900/45"
                    />
                    <div className="absolute left-0 top-0 h-full w-[84%] max-w-[340px] overflow-y-auto p-4">
                        <div className="mb-3 flex justify-end">
                            <button
                                type="button"
                                onClick={closeMobileMenu}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm"
                                aria-label="메뉴 닫기"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        {menuContent}
                    </div>
                </div>
            ) : null}

            <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 pb-4 md:flex-row md:py-4">
                <aside className="hidden w-full shrink-0 md:sticky md:top-4 md:block md:w-[260px] md:self-start">
                    {menuContent}
                </aside>

                <main className="min-w-0 flex-1">{children}</main>
            </div>
        </div>
    );
}
