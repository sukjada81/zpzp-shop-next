// src/app/(seller)/seller/[tenant]/orders/[id]/page.tsx
import { notFound } from "next/navigation";
import SellerOrderDetailClient from "@/components/seller/SellerOrderDetailClient";
import { normalizeTenant } from "@/lib/tenant/getTenant";

export default async function SellerOrderDetailPage({
                                                        params,
                                                    }: {
    params:
        | Promise<{ tenant: string; id: string }>
        | { tenant: string; id: string };
}) {
    const resolved = await Promise.resolve(params);

    const tenant = normalizeTenant(resolved?.tenant);
    const id = String(resolved?.id ?? "").trim();

    if (!tenant || !id) {
        notFound();
    }

    return <SellerOrderDetailClient tenant={tenant} id={id} />;
}