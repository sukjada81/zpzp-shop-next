// src/components/seller/SellerShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    ShoppingBag,
    Users,
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
    const ordersHref = `/${tenant}/orders`;
    const membersHref = `/${tenant}/members`;

    const isDashboardActive = pathname === `/${tenant}` || pathname === `/seller/${tenant}`;

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
            <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-4 md:flex-row">
                <aside className="w-full shrink-0 md:sticky md:top-4 md:w-[260px] md:self-start">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                        <div className="mb-5">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Seller Console
                            </div>
                            <div className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                                {tenant}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                                매장 운영 / 주문 / 회원 관리
                            </div>
                        </div>

                        <div className="mb-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                            {sessionLoading ? (
                                <div className="text-sm text-slate-500">로그인 상태 확인 중...</div>
                            ) : loggedIn ? (
                                <div className="space-y-3">
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                            Signed In
                                        </div>
                                        <div className="mt-1 text-sm font-semibold text-slate-900">
                                            {memberName}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            {session?.member?.email || "카카오 로그인 사용자"}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleLogout}
                                        disabled={logoutLoading}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        <span>{logoutLoading ? "로그아웃 중..." : "로그아웃"}</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="text-sm text-slate-600">
                                        셀러 콘솔 이용을 위해 로그인해주세요.
                                    </div>
                                    <Link
                                        href={loginHref}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:brightness-95"
                                    >
                                        <LogIn className="h-4 w-4" />
                                        <span>카카오 로그인</span>
                                    </Link>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <NavItem
                                href={dashboardHref}
                                label="대시보드"
                                icon={LayoutDashboard}
                                active={isDashboardActive}
                            />
                            <NavItem
                                href={ordersHref}
                                label="주문 관리"
                                icon={ShoppingBag}
                                active={isOrdersActive}
                            />
                            <NavItem
                                href={membersHref}
                                label="회원 관리"
                                icon={Users}
                                active={isMembersActive}
                            />
                        </div>
                    </div>
                </aside>

                <main className="min-w-0 flex-1">{children}</main>
            </div>
        </div>
    );
}