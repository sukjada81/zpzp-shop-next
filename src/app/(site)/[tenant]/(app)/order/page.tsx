// src/app/(site)/[tenant]/(app)/order/page.tsx
"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import OrderClient, { type OrderItem } from "@/components/order/OrderClient";
import { useCart, type CartItem } from "@/lib/cart/CartProvider";

export default function OrderPage() {
    const { tenant } = useParams<{ tenant: string }>();
    const { items } = useCart();

    const initialItems: OrderItem[] = useMemo(
        () =>
            items.map((it: CartItem) => ({
                id: String(it.productId),
                title: it.name,
                price: Number(it.price ?? 0),
                qty: Number(it.quantity ?? 0),
                optionId: it.optionId,
                optionName: it.optionName,
            })),
        [items]
    );

    if (!tenant) {
        return (
            <main className="mx-auto w-full max-w-[520px] px-4 py-10 text-center text-slate-500">
                지점 정보를 확인하는 중입니다.
            </main>
        );
    }

    return <OrderClient tenant={tenant} initialItems={initialItems} />;
}