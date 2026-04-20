"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import MobileHeader from "./MobileHeader";
import SideDrawer from "./SideDrawer";
import Footer from "./Footer";

const BRAND_NAME = "디스카운트 올데이";

function normalizeTenant(raw: string) {
    const t = (raw || "").trim();
    if (!t || t.toLowerCase() === "undefined" || t.toLowerCase() === "null") return "";
    return t;
}

function extractTenantFromPath(pathname?: string | null) {
    if (!pathname) return "";
    const segs = pathname.split("/").filter(Boolean);
    if (segs.length === 0) return "";

    if (segs[0] === "seller") return normalizeTenant(segs[1] || "");
    return normalizeTenant(segs[0] || "");
}

export default function AppShellClient({
                                           tenant: rawTenant,
                                           tenantName = "",
                                           children,
                                       }: {
    tenant: string;
    tenantName?: string;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const propTenant = normalizeTenant(rawTenant);
    const pathTenant = useMemo(() => extractTenantFromPath(pathname), [pathname]);
    const tenant = propTenant || pathTenant;

    const hideHeader = useMemo(() => {
        return pathname?.includes(`/login`) ?? false;
    }, [pathname]);

    const isOrderPage = useMemo(() => {
        if (!pathname || !tenant) return false;

        const base = `/${tenant}/order`;
        return pathname === base || pathname.startsWith(base + "/");
    }, [pathname, tenant]);

    const isGoodsDetailPage = useMemo(() => {
        if (!pathname || !tenant) return false;

        const goodsBase = `/${tenant}/goods/`;
        if (!pathname.startsWith(goodsBase)) return false;

        const rest = pathname.slice(goodsBase.length);
        if (!rest) return false;
        if (rest.includes("/")) return false;

        return true;
    }, [pathname, tenant]);

    const title = useMemo(() => {
        if (!pathname) return BRAND_NAME;

        const p =
            tenant && pathname.startsWith(`/${tenant}`)
                ? pathname.slice(`/${tenant}`.length)
                : pathname;

        if (p === "" || p === "/") return "홈";
        if (p.startsWith("/home")) return BRAND_NAME;
        if (p.startsWith("/goods")) return "상품";
        if (p.startsWith("/orders")) return "주문내역";
        if (p.startsWith("/order")) return "주문/결제";
        if (p.startsWith("/cart")) return "장바구니";
        return BRAND_NAME;
    }, [pathname, tenant]);

    const brandLabel = tenantName || "";
    const subLabel = tenantName || "";

    const headerMode = useMemo<"default" | "order" | "back">(() => {
        if (isOrderPage) return "order";
        if (isGoodsDetailPage) return "back";
        return "default";
    }, [isOrderPage, isGoodsDetailPage]);

    return (
        <div className="min-h-dvh bg-white text-[color:var(--fg)]">
            {!hideHeader && (
                <MobileHeader
                    tenant={tenant}
                    title={title}
                    storeName={tenantName}
                    mode={headerMode}
                    onMenuAction={() => {
                        if (isOrderPage || isGoodsDetailPage) {
                            router.back();
                            return;
                        }
                        setDrawerOpen(true);
                    }}
                    onCartAction={() => {
                        if (!tenant) router.push("/select-tenant?change=1");
                        else router.push(`/${tenant}/cart`);
                    }}
                />
            )}

            {!isOrderPage && (
                <SideDrawer
                    tenant={tenant}
                    open={drawerOpen}
                    onCloseAction={() => setDrawerOpen(false)}
                    brandLabel={brandLabel}
                    subLabel={subLabel}
                />
            )}

            <div className="relative pb-10">{children}</div>
            <Footer />
        </div>
    );
}