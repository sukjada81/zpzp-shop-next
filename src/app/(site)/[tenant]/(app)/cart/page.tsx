// src/app/(site)/[tenant]/(app)/cart/page.tsx
import CartPageClient from "@/components/cart/CartPageClient";

export default async function CartPage({
                                           params,
                                       }: {
    params: Promise<{ tenant: string }>;
}) {
    const { tenant } = await params;

    return <CartPageClient tenant={tenant} />;
}