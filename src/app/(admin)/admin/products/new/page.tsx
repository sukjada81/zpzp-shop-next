// src/app/(admin)/admin/products/new/page.tsx
import { getAdminTenants } from "@/lib/admin/adminApi";
import ProductCreateForm from "@/components/admin/products/ProductCreateForm";

export default async function AdminProductNewPage() {
    const tenants = await getAdminTenants();

    return (
        <main className="mx-auto w-full max-w-[980px] px-3 pb-10 pt-6 sm:px-4">
            <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                    <div className="text-xl font-extrabold text-[var(--dad-ink)]">상품 등록</div>
                    <div className="mt-1 text-sm text-[var(--dad-muted)]">
                        지점을 선택하고 상품/옵션을 등록합니다.
                    </div>
                </div>

                <a href="/admin/products" className="dad-btn dad-btn-ghost h-10 px-4 text-sm">
                    ← 목록
                </a>
            </div>

            <div className="dad-card p-5">
                <ProductCreateForm tenants={tenants} />
            </div>
        </main>
    );
}