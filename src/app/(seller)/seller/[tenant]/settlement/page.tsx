// src/app/(seller)/seller/[tenant]/settlement/page.tsx
import { notFound } from "next/navigation";
import SellerSettlementClient from "@/components/seller/SellerSettlementClient";

export default async function SellerSettlementPage({
    params,
}: {
    params: Promise<{ tenant: string }> | { tenant: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = resolved?.tenant;

    if (!tenant) notFound();
    return <SellerSettlementClient tenant={tenant} />;
}
