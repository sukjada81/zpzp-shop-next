// src/app/(seller)/seller/[tenant]/orders/page.tsx
import SellerOrdersClient from "@/components/seller/SellerOrdersClient";

export default async function SellerOrdersPage({
                                                   params,
                                               }: {
    params: Promise<{ tenant: string }> | { tenant: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = String(resolved?.tenant ?? "").trim();

    if (!tenant) {
        return <div className="p-6">tenant 정보가 없습니다.</div>;
    }

    return <SellerOrdersClient tenant={tenant} />;
}