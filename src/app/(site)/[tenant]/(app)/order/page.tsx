// src/app/(site)/[tenant]/(app)/order/page.tsx
"use client";

import OrderClient, { type OrderItem } from "@/components/order/OrderClient";
import { useCart } from "@/lib/cart/CartProvider";

type PageProps = {
    params: { tenant: string };
};

export default function OrderPage({ params }: PageProps) {
    const { tenant } = params;

    const { items } = useCart();

    const initialItems: OrderItem[] = items.map((it: any) => ({
        id: it.productId,
        title: it.name,
        price: it.price,
        qty: it.quantity,
    }));

    return <OrderClient tenant={tenant} initialItems={initialItems} />;
}