// src/app/(seller)/seller/[tenant]/products/page.tsx
import { redirect } from "next/navigation";

export default async function SellerProductsPage({
                                                     params,
                                                 }: {
    params: Promise<{ tenant: string }> | { tenant: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = resolved?.tenant;

    if (!tenant) {
        redirect("/seller");
    }

    redirect(`/seller/${tenant}/orders`);
}