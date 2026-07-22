// src/app/(seller)/seller/[tenant]/products/page.tsx
import { notFound } from "next/navigation";
import SellerProductsClient from "@/components/seller/SellerProductsClient";

export default async function SellerProductsPage({
                                                     params,
                                                 }: {
    params: Promise<{ tenant: string }> | { tenant: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = resolved?.tenant;

    if (!tenant) notFound();
    return <SellerProductsClient tenant={tenant} />;
}
