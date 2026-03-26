// src/components/seller/SellerShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    ShoppingBag,
    Users,
    BarChart3,
    LogIn,
    LogOut,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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

function NavItem({
                     href,
                     label,
                     icon: Icon,
                     active,
                 }: {
    href: string;
    label: string;
    icon: any;
    active: boolean;
}) {
    return (
        <Link
            href={href}
            className={[
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                active
                    ? "bg-blue-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.28)]"
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
                                        children,
                                    }: {
    tenant: string;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [session, setSession] = useState<SessionResponse | null>(null);
    const [sessionLoading, setSessionLoading] = useState(true);
    const [logoutLoading, setLogoutLoading] = useState(false);

    const dashboardHref = `/${tenant}`;
    const salesHref = `/${tenant}/sales`;
    const ordersHref = `/${tenant}/orders`;
    const membersHref = `/${tenant}/members`;

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

    useEffect(() => {
        let alive = true;

        async function loadSession() {
            try {
                setSessionLoading(true);

                const res = await fetch("/auth/session", {
                    method: "GET",
                    cache: "no-store",
                    credentials: "include",
                    headers: {
                        accept: "application/json",
                    },
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

        return () => {
            alive = false;
        };
    }, []);

    const loginHref = useMemo(() => {
        if (typeof window === "undefined") return "#";
        const origin = window.location.origin;
        const returnTo = `${origin}/${tenant}`;
        return `/auth/kakao/login?tenant=${encodeURIComponent(tenant)}&returnTo=${encodeURIComponent(returnTo)}`;
    }, [tenant]);

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

    const memberName = session?.member?.name?.trim() || "회원";
    const loggedIn = Boolean(session?.loggedIn && session?.member?.uid);

    return (
        <div className="min-h-screen bg-[#EEF2F8]">
            <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-4 md:flex-row">
                <aside className="w-full shrink-0 md:sticky md:top-4 md:w-[260px] md:self-start">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                        <div className="mb-5">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Seller Console
                            </div>
                            <div className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                                {tenant}
                            </div>
                            <div className="mt-2 text-sm text-slate-500">
                                지점 운영 / 주문 / 회원 / 매출 통계
                            </div>
                        </div>

                        <div className="space-y-2">
                            <NavItem
                                href={dashboardHref}
                                label="대시보드"
                                icon={LayoutDashboard}
                                active={isDashboardActive}
                            />
                            <NavItem
                                href={salesHref}
                                label="매출통계"
                                icon={BarChart3}
                                active={isSalesActive}
                            />
                            <NavItem
                                href={ordersHref}
                                label="주문관리"
                                icon={ShoppingBag}
                                active={isOrdersActive}
                            />
                            <NavItem
                                href={membersHref}
                                label="회원관리"
                                icon={Users}
                                active={isMembersActive}
                            />
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
                                    <div className="mt-1 text-xs text-slate-500">
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
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                                >
                                    <LogIn className="h-4 w-4" />
                                    카카오 로그인
                                </Link>
                            )}
                        </div>
                    </div>
                </aside>

                <main className="min-w-0 flex-1">{children}</main>
            </div>
        </div>
    );
}