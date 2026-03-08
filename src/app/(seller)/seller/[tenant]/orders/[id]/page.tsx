// src/app/(seller)/seller/[tenant]/orders/[id]/page.tsx
import SellerOrderDetailClient from "@/components/seller/SellerOrderDetailClient";

export default async function SellerOrderDetailPage({
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
        return <div className="p-6">tenant 또는 주문 ID가 없습니다.</div>;
    }

    return <SellerOrderDetailClient tenant={tenant} id={id} />;
}