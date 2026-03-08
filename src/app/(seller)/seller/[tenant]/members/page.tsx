// src/app/(seller)/seller/[tenant]/members/page.tsx
import SellerMembersClient from "@/components/seller/SellerMembersClient";

export default async function SellerMembersPage({
                                                    params,
                                                }: {
    params: Promise<{ tenant: string }> | { tenant: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = resolved?.tenant;

    if (!tenant) {
        return <div className="p-6">tenant 정보가 없습니다.</div>;
    }

    return <SellerMembersClient tenant={tenant} />;
}