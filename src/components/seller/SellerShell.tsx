// src/components/seller/SellerShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ShoppingBag, Users } from "lucide-react";
import { getSellerHref } from "@/lib/seller/getSellerHref";

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

    const dashboardHref = getSellerHref(tenant);
    const productsHref = getSellerHref(tenant, "/products");
    const ordersHref = getSellerHref(tenant, "/orders");
    const membersHref = getSellerHref(tenant, "/members");

    const isDashboardActive =
        pathname === `/seller/${tenant}` || pathname === `/${tenant}`;

    const isProductsActive =
        pathname.startsWith(`/seller/${tenant}/products`) ||
        pathname.startsWith(`/${tenant}/products`);

    const isOrdersActive =
        pathname.startsWith(`/seller/${tenant}/orders`) ||
        pathname.startsWith(`/${tenant}/orders`);

    const isMembersActive =
        pathname.startsWith(`/seller/${tenant}/members`) ||
        pathname.startsWith(`/${tenant}/members`);

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
                                매장 운영 / 상품 / 주문 / 회원 관리
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
                                href={productsHref}
                                label="상품 관리"
                                icon={Package}
                                active={isProductsActive}
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