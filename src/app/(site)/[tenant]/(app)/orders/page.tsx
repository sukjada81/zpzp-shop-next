// src/app/(site)/[tenant]/(app)/orders/page.tsx
"use client";

import { useParams } from "next/navigation";
import OrdersClient from "@/components/orders/OrdersClient";

export default function OrdersPage() {
    const params = useParams<{ tenant: string }>();
    const tenant = String(params?.tenant ?? "").trim();

    return (
        <main className="mx-auto w-full max-w-[520px] px-4 pb-24 pt-3">
            <OrdersClient tenant={tenant} />
        </main>
    );
}