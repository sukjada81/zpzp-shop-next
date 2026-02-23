"use client";

import OrderClient, { type OrderItem } from "@/components/order/OrderClient";
import { useCart, type CartItem } from "@/lib/cart/CartProvider";
import { useParams } from "next/navigation";

export default function OrderPage() {
    const { tenant } = useParams<{ tenant: string }>();
    const { items } = useCart();

    if (!tenant) return null;

    const initialItems: OrderItem[] = items.map((it: CartItem) => ({
        id: it.productId,
        title: it.name,
        price: it.price,
        qty: it.quantity,
    }));

    return <OrderClient tenant={tenant} initialItems={initialItems} />;
}