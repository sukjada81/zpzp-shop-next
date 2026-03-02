// src/app/(site)/[tenant]/layout.tsx
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CartProvider } from "@/lib/cart/CartProvider";

function normalizeTenant(raw: string) {
    const t = (raw || "").toLowerCase().trim();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

export default async function SiteTenantLayout({
                                                   children,
                                                   params,
                                               }: {
    children: ReactNode;
    params: { tenant: string } | Promise<{ tenant: string }>;
}) {
    const resolved = await Promise.resolve(params);
    const tenant = normalizeTenant(resolved?.tenant);

    if (!tenant) notFound();

    // ✅ IMPORTANT:
    // 서브도메인 + DB 기반 테넌트 확장 구조에서는
    // 프론트에서 고정 리스트(getTenantList)로 테넌트를 검증하면
    // DB에 새 지점이 추가될 때마다 프론트가 404를 내게 됩니다.
    // 테넌트 존재/상태 검증은 백엔드(tenant plugin + DB)에서 처리하세요.

    return <CartProvider>{children}</CartProvider>;
}