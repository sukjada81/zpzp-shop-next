// src/app/(seller)/seller/[tenant]/products/[id]/page.tsx
import SellerProductDetailClient from "@/components/seller/SellerProductDetailClient";

export default async function SellerProductDetailPage({
                                                          params,
                                                      }: {
    params:
        | Promise<{ tenant: string; id: string }>
        | { tenant: string; id: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = resolved?.tenant;
    const id = resolved?.id;

    if (!tenant || !id) {
        return <div className="p-6">tenant 또는 상품 ID가 없습니다.</div>;
    }

    return <SellerProductDetailClient tenant={tenant} id={id} />;
}