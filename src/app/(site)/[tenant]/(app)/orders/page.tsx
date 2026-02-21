// src/app/(site)/[tenant]/(app)/orders/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import OrdersClient from "@/components/orders/OrdersClient";
import { loadOrders, type OrderRecord } from "@/lib/orders/ordersStore";

type PageProps = {
    params: { tenant: string };
};

export default function OrdersPage({ params }: PageProps) {
    const tenant = params.tenant;

    const [orders, setOrders] = useState<OrderRecord[]>([]);

    useEffect(() => {
        setOrders(loadOrders(tenant));
    }, [tenant]);

    // OrdersClient가 쓰는 summary 형태로 맞추기
    const initialOrders = useMemo(
        () =>
            orders.map((o) => ({
                orderNo: o.orderNo,
                status: o.status,
                title: o.title,
                totalPrice: o.totalPrice,
                createdAt: o.createdAt,
            })),
        [orders],
    );

    return (
        <main className="mx-auto w-full max-w-[520px] px-4 pb-24 pt-3">
            <div className="mb-3 flex items-center justify-between">
                <h1 className="text-base font-extrabold text-slate-900">주문내역</h1>

                <Link
                    href={`/${tenant}/goods`}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm active:scale-[0.99]"
                >
                    상품 보기
                </Link>
            </div>

            <OrdersClient tenant={tenant} initialOrders={initialOrders} />
        </main>
    );
}