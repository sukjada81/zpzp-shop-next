// src/app/(seller)/seller/[tenant]/layout.tsx
import SellerShell from "@/components/seller/SellerShell";

export default async function SellerTenantLayout({
                                                     children,
                                                     params,
                                                 }: {
    children: React.ReactNode;
    params: Promise<{ tenant: string }> | { tenant: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = resolved?.tenant;

    if (!tenant) {
        return <div className="p-6">tenant 정보가 없습니다.</div>;
    }

    return <SellerShell tenant={tenant}>{children}</SellerShell>;
}