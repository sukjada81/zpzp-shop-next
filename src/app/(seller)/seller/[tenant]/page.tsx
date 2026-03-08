// src/app/(seller)/seller/[tenant]/page.tsx
import SellerDashboardClient from "@/components/seller/SellerDashboardClient";

export default async function SellerTenantDashboardPage({
                                                            params,
                                                        }: {
    params: Promise<{ tenant: string }> | { tenant: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = resolved?.tenant;

    if (!tenant) {
        return <div className="p-6">tenant 정보가 없습니다.</div>;
    }

    return <SellerDashboardClient tenant={tenant} />;
}