"use client";

import { useEffect, useMemo, useState, use } from "react";
import OrdersClient from "@/components/orders/OrdersClient";
import { loadOrders, type OrderRecord } from "@/lib/orders/ordersStore";

type PageProps = {
    params: Promise<{ tenant: string }>;
};

export default function OrdersPage({ params }: PageProps) {
    const { tenant } = use(params);

    const [orders, setOrders] = useState<OrderRecord[]>([]);

    useEffect(() => {
        setOrders(loadOrders(tenant));
    }, [tenant]);

    const initialOrders = useMemo(
        () =>
            orders.map((o) => ({
                orderNo: o.orderNo,
                status: o.status,
                title: o.title,
                totalPrice: o.totalPrice,
                createdAt: o.createdAt,
                thumbnailUrl: o.lines?.[0]?.thumbnailUrl || "",
            })),
        [orders]
    );

    return (
        <main className="mx-auto w-full max-w-[520px] px-4 pb-24 pt-3">
            <OrdersClient tenant={tenant} initialOrders={initialOrders} />
        </main>
    );
}