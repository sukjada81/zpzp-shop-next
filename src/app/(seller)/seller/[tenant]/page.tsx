// src/app/(seller)/seller/[tenant]/page.tsx
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import SellerDashboardClient, {
    type SellerDashboardData,
} from "@/components/seller/SellerDashboardClient";

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

async function fetchSellerDashboard(
    tenant: string
): Promise<SellerDashboardData | null> {
    const origin = getInternalOrigin();
    const url = new URL(`/api/seller/${tenant}/dashboard`, origin);
    const cookie = await getCookieHeader();

    const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: {
            cookie,
            "x-tenant-slug": tenant,
        },
    });

    if (!res.ok) return null;

    const data = (await res.json().catch(() => null)) as SellerDashboardData | null;
    if (!data?.ok) return null;

    return data;
}

export default async function SellerDashboardPage({
                                                      params,
                                                  }: {
    params: Promise<{ tenant: string }> | { tenant: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = String(resolved?.tenant ?? "").trim();

    if (!tenant) notFound();

    const data = await fetchSellerDashboard(tenant);
    if (!data) notFound();

    return <SellerDashboardClient tenant={tenant} data={data} />;
}