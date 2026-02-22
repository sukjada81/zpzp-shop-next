// src/app/(site)/[tenant]/(app)/cart/page.tsx
import CartPageClient from "@/components/cart/CartPageClient";

export default function CartPage({
                                     params,
                                 }: {
    params: { tenant: string };
}) {
    // ✅ Server Component에서는 params 동기 접근 OK
    const { tenant } = params;

    return <CartPageClient tenant={tenant} />;
}