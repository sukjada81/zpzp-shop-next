// src/app/(admin)/admin/products/[id]/page.tsx
import ProductEditForm from "@/components/admin/products/ProductEditForm";
import { getAdminProductDetail } from "@/lib/admin/adminApi";

export default async function Page({
                                       params,
                                   }: {
    params: { id: string } | Promise<{ id: string }>;
}) {
    // ✅ Next.js 16: params Promise 대응
    const resolved = await Promise.resolve(params);
    const id = String(resolved?.id ?? "").trim();

    if (!id) {
        return <div className="p-6">상품 ID가 없습니다. (잘못된 경로)</div>;
    }

    // ✅ id가 숫자(BigInt PK)인지 1차 방어 (깨진 라우팅/undefined 방지)
    if (!/^\d+$/.test(id)) {
        return <div className="p-6">상품 ID 형식이 올바르지 않습니다.</div>;
    }

    const data = await getAdminProductDetail(id);

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
                <ProductEditForm product={data.product} />
            </div>
        </main>
    );
}