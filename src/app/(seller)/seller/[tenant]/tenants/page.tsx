// src/app/(seller)/seller/[tenant]/tenants/page.tsx
import { cookies, headers } from "next/headers";
import SellerTenantsListClient from "@/components/seller/SellerTenantsListClient";

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

export default async function SellerTenantsPage({
    params,
}: {
    params: Promise<{ tenant: string }>;
}) {
    const { tenant } = await params;

    const origin = getInternalOrigin();
    const cookieHeader = await getCookieHeader();
    const hostHeader = (await headers()).get("host") || "";

    const res = await fetch(`${origin}/api/proxy/v1/seller/tenants?status=all`, {
        cache: "no-store",
        headers: {
            cookie: cookieHeader,
            "x-tenant-slug": tenant,
            "x-forwarded-host": hostHeader,
        },
    });
    const data = await res.json().catch(() => null);
    const items = Array.isArray(data?.items) ? data.items : [];

    return <SellerTenantsListClient items={items} />;
}
