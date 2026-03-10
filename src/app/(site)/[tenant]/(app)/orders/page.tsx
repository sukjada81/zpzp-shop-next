// src/app/(site)/[tenant]/(app)/orders/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import OrdersClient from "@/components/orders/OrdersClient";
import { endpoints } from "@/lib/api/endpoints";

type OrderItemDto = {
    id: string;
    productId: string;
    title: string;
    price: number;
    qty: number;
    optionName?: string;
    status: number;
};

type MyOrdersResponse = {
    ok: boolean;
    total: number;
    page: number;
    limit: number;
    items: Array<{
        id: string;
        orderNum: string;
        buyerName: string;
        buyerPhone: string;
        totalAmount: number;
        pickupAt?: string | null;
        status: number;
        statusLabel: string;
        createdAt: string | null;
        items: OrderItemDto[];
    }>;
};

export default function OrdersPage() {
    const { tenant } = useParams<{ tenant: string }>();
    const searchParams = useSearchParams();

    const [orders, setOrders] = useState<MyOrdersResponse["items"]>([]);
    const [loading, setLoading] = useState(true);
    const createdOrderNo = searchParams.get("created") || "";

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!tenant) return;

            try {
                setLoading(true);

                const res = await fetch(endpoints.myOrders(tenant, { page: 1, limit: 50 }), {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                });

                const json = (await res.json().catch(() => null)) as MyOrdersResponse | null;

                if (cancelled) return;

                if (!res.ok || !json?.ok) {
                    setOrders([]);
                    return;
                }

                setOrders(json.items ?? []);
            } catch {
                if (!cancelled) {
                    setOrders([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [tenant]);

    const initialOrders = useMemo(
        () =>
            (orders ?? []).map((o) => ({
                orderNo: o.orderNum,
                status: o.statusLabel || "주문접수",
                title:
                    o.items?.length > 1
                        ? `${o.items[0]?.title ?? "상품"} 외 ${o.items.length - 1}건`
                        : o.items?.[0]?.title ?? "주문 상품",
                totalPrice: Number(o.totalAmount ?? 0),
                createdAt: o.createdAt ?? "",
                pickupAt: o.pickupAt ?? null,
                isNew: createdOrderNo === o.orderNum,
                thumbnailUrl: "",
            })),
        [orders, createdOrderNo]
    );

    return (
        <main className="mx-auto w-full max-w-[520px] px-4 pb-24 pt-3">
            <OrdersClient tenant={tenant} initialOrders={initialOrders} loading={loading} />
        </main>
    );
}