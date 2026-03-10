// src/app/(admin)/admin/products/[id]/page.tsx
import ProductEditForm from "@/components/admin/products/ProductEditForm";
import { getAdminProductDetail } from "@/lib/admin/adminApi";
import { headers } from "next/headers";

type TenantRow = {
    id: string | number;
    slug?: string | null;
    name?: string | null;
};

type TenantsResponse = {
    ok?: boolean;
    tenants?: TenantRow[];
    rows?: TenantRow[];
};

function getInternalOrigin() {
    return process.env.NEXT_INTERNAL_ORIGIN || "http://127.0.0.1:3000";
}

async function getTenants(): Promise<TenantRow[]> {
    const h = await headers();
    const cookie = h.get("cookie") || "";

    const url = new URL("/api/proxy/admin/tenants?pageSize=100", getInternalOrigin());

    const res = await fetch(url.toString(), {
        headers: {
            cookie,
            accept: "application/json",
        },
        cache: "no-store",
    });

    if (!res.ok) return [];

    const data = (await res.json().catch(() => null)) as TenantsResponse | null;
    if (!data) return [];

    return Array.isArray(data.tenants)
        ? data.tenants
        : Array.isArray(data.rows)
            ? data.rows
            : [];
}

export default async function Page({
                                       params,
                                   }: {
    params: { id: string } | Promise<{ id: string }>;
}) {
    const resolved = await Promise.resolve(params);
    const id = String(resolved?.id ?? "").trim();

    if (!id) {
        return <div className="p-6">상품 ID가 없습니다. (잘못된 경로)</div>;
    }

    if (!/^\d+$/.test(id)) {
        return <div className="p-6">상품 ID 형식이 올바르지 않습니다.</div>;
    }

    const [data, tenants] = await Promise.all([getAdminProductDetail(id), getTenants()]);

    if (!data?.product) {
        return <div className="p-6">상품을 찾을 수 없습니다.</div>;
    }

    return (
        <main className="mx-auto w-full max-w-[980px] px-3 pb-10 pt-6 sm:px-4">
            <div className="mb-4">
                <div className="text-xl font-extrabold text-[var(--dad-ink)]">상품 수정</div>
                <div className="mt-1 text-sm text-[var(--dad-muted)]">
                    상품 기본정보/상태를 수정합니다.
                </div>
            </div>

            <div className="dad-card p-4 sm:p-6">
                <ProductEditForm product={data.product} tenants={tenants} />
            </div>
        </main>
    );
}