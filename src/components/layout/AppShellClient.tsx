"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import MobileHeader from "./MobileHeader";
import SideDrawer from "./SideDrawer";

export default function AppShellClient({
                                           tenant,
                                           children,
                                       }: {
    tenant: string;
    children: React.ReactNode;
}) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    const hideHeader = useMemo(() => {
        return pathname?.includes(`/${tenant}/login`) ?? false;
    }, [pathname, tenant]);

    const title = useMemo(() => {
        if (!pathname) return "오늘의 공구";

        const p = pathname.startsWith(`/${tenant}`)
            ? pathname.slice(`/${tenant}`.length)
            : pathname;

        if (p === "" || p === "/") return "홈";
        if (p.startsWith("/home")) return "오늘의 공구";
        if (p.startsWith("/goods")) return "상품";
        if (p.startsWith("/orders")) return "주문내역";
        if (p.startsWith("/order")) return "주문서";
        if (p.startsWith("/cart")) return "장바구니";

        return "오늘의 공구";
    }, [pathname, tenant]);

    return (
        <div className="min-h-dvh bg-[var(--bg)]">
            {!hideHeader && (
                <MobileHeader
                    tenant={tenant}
                    title={title}
                    onMenuAction={() => setDrawerOpen(true)}
                    onCartAction={() => router.push(`/${tenant}/cart`)}
                />
            )}

            <SideDrawer
                tenant={tenant}
                open={drawerOpen}
                onCloseAction={() => setDrawerOpen(false)}
            />

            <div className="pb-10">{children}</div>
        </div>
    );
}