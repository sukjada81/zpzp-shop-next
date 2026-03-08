// src/app/(seller)/seller/[tenant]/products/page.tsx
import SellerProductsClient from "@/components/seller/SellerProductsClient";

export default async function SellerProductsPage({
                                                     params,
                                                 }: {
    params: Promise<{ tenant: string }> | { tenant: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = resolved?.tenant;

    if (!tenant) {
        return <div className="p-6">tenant 정보가 없습니다.</div>;
    }

    return <SellerProductsClient tenant={tenant} />;
}