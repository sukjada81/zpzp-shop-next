import SellerMemberDetailClient from "@/components/seller/SellerMemberDetailClient";

export default async function Page({
                                       params,
                                   }: {
    params: Promise<{ tenant: string; id: string }> | { tenant: string; id: string };
}) {
    const { tenant, id } = await Promise.resolve(params);

    return <SellerMemberDetailClient tenant={tenant} id={id} />;
}