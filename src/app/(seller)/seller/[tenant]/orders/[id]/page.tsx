// src/app/(seller)/seller/[tenant]/orders/[id]/page.tsx
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import SellerOrderDetailClient from "@/components/seller/SellerOrderDetailClient";

function getInternalOrigin() {
    return (
        process.env.NEXT_INTERNAL_ORIGIN ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://127.0.0.1:3000"
    );
}

async function getCookieHeader() {
    const store = await cookies();
    return store
        .getAll()
        .map((item) => `${item.name}=${item.value}`)
        .join("; ");
}

async function fetchSellerOrderDetail(tenant: string, id: string) {
    const origin = getInternalOrigin();
    const url = new URL(`/api/seller/${tenant}/orders/${id}`, origin);
    const cookie = await getCookieHeader();

    const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: {
            cookie,
            "x-tenant-slug": tenant,
        },
    });

    if (!res.ok) return null;

    const data = await res.json().catch(() => null);
    if (!data?.ok) return null;

    return data;
}

export default async function SellerOrderDetailPage({
                                                        params,
                                                    }: {
    params: Promise<{ tenant: string; id: string }> | { tenant: string; id: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = String(resolved?.tenant ?? "").trim();
    const id = String(resolved?.id ?? "").trim();

    if (!tenant || !id) notFound();

    const data = await fetchSellerOrderDetail(tenant, id);
    if (!data) notFound();

    return <SellerOrderDetailClient tenant={tenant} id={id} />;
}