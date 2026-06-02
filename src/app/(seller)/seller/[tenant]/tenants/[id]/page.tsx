// src/app/(seller)/seller/[tenant]/tenants/[id]/page.tsx
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import SellerTenantFormClient from "@/components/seller/SellerTenantFormClient";

export const dynamic = "force-dynamic";

function getInternalOrigin() {
    return (
        process.env.NEXT_INTERNAL_ORIGIN ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://127.0.0.1:3000"
    );
}

async function getCookieHeader() {
    const store = await cookies();
    return store.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
}

export default async function SellerTenantEditPage({
    params,
}: {
    params: Promise<{ tenant: string; id: string }>;
}) {
    const { tenant, id } = await params;
    if (!/^\d+$/.test(id)) notFound();

    const origin = getInternalOrigin();
    const cookieHeader = await getCookieHeader();
    const hostHeader = (await headers()).get("host") || "";

    const res = await fetch(`${origin}/api/proxy/v1/seller/tenants/${id}`, {
        cache: "no-store",
        headers: {
            cookie: cookieHeader,
            "x-tenant-slug": tenant,
            "x-forwarded-host": hostHeader,
        },
    });
    if (!res.ok) notFound();
    const data = await res.json().catch(() => null);
    if (!data?.ok || !data.tenant) notFound();

    return <SellerTenantFormClient mode="edit" tenant={data.tenant} />;
}
