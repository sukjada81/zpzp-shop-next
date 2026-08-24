// src/app/(seller)/seller/[tenant]/products/page.tsx
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import SellerProductsClient, {
    type SellerProductsInitialData,
} from "@/components/seller/SellerProductsClient";
import SellerNoAccess from "@/components/seller/SellerNoAccess";
import { isAuthError, getInternalOrigin } from "@/lib/seller/fetchSeller";

async function fetchSellerProducts(tenant: string): Promise<{
    ok: boolean;
    status: number;
    message?: string;
    data: SellerProductsInitialData | null;
}> {
    const origin = getInternalOrigin();
    const url = new URL(`/api/seller/${tenant}/products`, origin);
    url.searchParams.set("selectedPage", "1");
    url.searchParams.set("availablePage", "1");
    url.searchParams.set("pageSize", "5");

    const store = await cookies();
    const cookie = store
        .getAll()
        .map((item) => `${item.name}=${item.value}`)
        .join("; ");

    try {
        const res = await fetch(url.toString(), {
            cache: "no-store",
            headers: { cookie, "x-tenant-slug": tenant },
        });
        const data = (await res.json().catch(() => null)) as SellerProductsInitialData | null;
        return {
            ok: Boolean(res.ok && data?.ok),
            status: res.status,
            message: data?.message,
            data,
        };
    } catch {
        return { ok: false, status: 500, message: "상품 정보를 불러오지 못했습니다.", data: null };
    }
}

export default async function SellerProductsPage({
    params,
}: {
    params: Promise<{ tenant: string }> | { tenant: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = String(resolved?.tenant ?? "").trim();

    if (!tenant) notFound();

    const result = await fetchSellerProducts(tenant);
    if (!result.ok) {
        if (isAuthError(result.status)) return <SellerNoAccess tenant={tenant} />;
        return <SellerProductsClient tenant={tenant} initialData={null} />;
    }

    return <SellerProductsClient tenant={tenant} initialData={result.data} />;
}
