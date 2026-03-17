// src/app/(seller)/seller/[tenant]/products/[id]/page.tsx
import { redirect } from "next/navigation";

export default async function SellerProductDetailPage({
                                                          params,
                                                      }: {
    params: Promise<{ tenant: string; id: string }> | { tenant: string; id: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = resolved?.tenant;

    if (!tenant) {
        redirect("/seller");
    }

    redirect(`/seller/${tenant}/orders`);
}