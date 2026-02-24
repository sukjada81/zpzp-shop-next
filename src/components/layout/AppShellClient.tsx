// src/components/layout/AppShellClient.tsx
"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import MobileHeader from "./MobileHeader";
import SideDrawer from "./SideDrawer";
import { getTenantList } from "@/lib/tenant/tenants";

function normalizeTenant(raw: string) {
    const t = (raw || "").toLowerCase().trim();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

function extractTenantFromPath(pathname?: string | null) {
    if (!pathname) return "";
    const segs = pathname.split("/").filter(Boolean);
    if (segs.length === 0) return "";

    // /seller/{tenant}/... 인 경우
    if (segs[0] === "seller") return normalizeTenant(segs[1] || "");

    // /{tenant}/... 인 경우
    return normalizeTenant(segs[0] || "");
}

export default function AppShellClient({
                                           tenant: rawTenant,
                                           children,
                                       }: {
    tenant: string;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [drawerOpen, setDrawerOpen] = useState(false);

    // ✅ 1) prop tenant (서버에서 내려준 값)
    const propTenant = normalizeTenant(rawTenant);

    // ✅ 2) pathname에서 tenant 역추출 (prop이 비거나 깨질 때 대비)
    const pathTenant = useMemo(() => extractTenantFromPath(pathname), [pathname]);

    // ✅ 최종 tenant: prop 우선, 없으면 pathname fallback
    const tenant = propTenant || pathTenant;

    const tenantInfo = useMemo(() => {
        if (!tenant) return null;
        const list = getTenantList();
        return list.find((t) => t.slug === tenant) ?? null;
    }, [tenant]);

    const hideHeader = useMemo(() => {
        // 로그인 화면에서는 헤더 숨김
        return pathname?.includes(`/login`) ?? false;
    }, [pathname]);

    const isOrderPage = useMemo(() => {
        if (!pathname) return false;
        return tenant ? pathname.startsWith(`/${tenant}/order`) : false;
    }, [pathname, tenant]);

    const title = useMemo(() => {
        if (!pathname) return "오늘의 공구";

        const p =
            tenant && pathname.startsWith(`/${tenant}`)
                ? pathname.slice(`/${tenant}`.length)
                : pathname;

        if (p === "" || p === "/") return "홈";
        if (p.startsWith("/home")) return "오늘의 공구";
        if (p.startsWith("/goods")) return "상품";
        if (p.startsWith("/orders")) return "주문내역";
        if (p.startsWith("/order")) return "주문/결제";
        if (p.startsWith("/cart")) return "장바구니";
        return "오늘의 공구";
    }, [pathname, tenant]);

    const brandLabel = tenantInfo?.name ?? "가맹점";
    const subLabel = `현재 지점 /${tenant || "-"}` + (tenantInfo?.name ? ` ${tenantInfo.name}` : "");

    return (
        <div className="min-h-dvh bg-[var(--bg)]">
            {!hideHeader && (
                <MobileHeader
                    tenant={tenant}
                    title={title}
                    mode={isOrderPage ? "order" : "default"}
                    onMenuAction={() => {
                        if (isOrderPage) router.back();
                        else setDrawerOpen(true);
                    }}
                    onCartAction={() => {
                        if (!tenant) router.push("/select-tenant?change=1");
                        else router.push(`/${tenant}/cart`);
                    }}
                />
            )}

            {/* ✅ 주문서에서는 드로어 숨김 */}
            {!isOrderPage && (
                <SideDrawer
                    tenant={tenant}
                    open={drawerOpen}
                    onCloseAction={() => setDrawerOpen(false)}
                    brandLabel={brandLabel}
                    subLabel={subLabel}
                />
            )}

            <div className="pb-10">{children}</div>
        </div>
    );
}