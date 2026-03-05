// src/app/(site)/[tenant]/(app)/goods/[id]/page.tsx
import { notFound } from "next/navigation";
import GoodsDetailClient, { type GoodsDetailData } from "@/components/goods/GoodsDetailClient";
import { endpoints } from "@/lib/api/endpoints";
import { normalizeTenant } from "@/lib/tenant/getTenant";
import type { ProductDetailResponse, PublicProductsResponse } from "@/lib/types/goods";

function getInternalOrigin() {
    return process.env.NEXT_INTERNAL_ORIGIN || process.env.NEXT_PUBLIC_BASE_URL || "http://127.0.0.1:3000";
}

/**
 * ✅ 1순위: 상세 API 사용
 * ✅ 2순위: 목록 fallback (최소 구성)
 */
async function fetchProductDetail(tenant: string, id: string): Promise<GoodsDetailData | null> {
    const origin = getInternalOrigin();

    // 1) 상세 API
    {
        const path = endpoints.publicProductDetail(tenant, id);
        const url = new URL(path, origin);
        const res = await fetch(url.toString(), { cache: "no-store" });

        if (res.ok) {
            const data = (await res.json().catch(() => null)) as ProductDetailResponse | null;
            if (data?.ok && data.product) {
                const p = data.product;

                const detail: GoodsDetailData = {
                    id: String(p.id),
                    title: String(p.title ?? ""),
                    price: Number(p.price ?? 0),
                    description: p.description ?? null,
                    badges: p.badges,
                    meta: p.meta,
                    images: Array.isArray(p.images) && p.images.length ? p.images : [{ key: "", label: "이미지 없음" }],
                    options:
                        Array.isArray(p.options) && p.options.length
                            ? p.options.map((o) => ({
                                id: String(o.id),
                                name: String(o.name ?? ""),
                                price: o.price === null || o.price === undefined ? null : Number(o.price),
                                soldout: !!o.soldout,
                                stockNote: o.stockNote,
                            }))
                            : [
                                {
                                    id: "default",
                                    name: "기본 옵션",
                                    price: null,
                                    soldout: false,
                                },
                            ],
                    notices: Array.isArray(p.notices) ? p.notices : [],
                };

                return detail;
            }
        }
    }

    // 2) fallback: 목록에서 찾기
    {
        const path = endpoints.publicProducts(tenant, { take: 200 });
        const url = new URL(path, origin);

        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) return null;

        const data = (await res.json().catch(() => null)) as PublicProductsResponse | null;
        if (!data?.ok) return null;

        const found = (data.items ?? []).find((p) => String(p.id) === String(id));
        if (!found) return null;

        const detail: GoodsDetailData = {
            id: String(found.id),
            title: String(found.title ?? ""),
            price: Number(found.price ?? 0),
            description: null,
            badges: undefined,
            meta: {
                timeLeft: found.metaLeft,
                pickup: found.metaRight,
            },
            images: [{ key: "", label: "이미지 없음" }],
            options: [
                {
                    id: "default",
                    name: "기본 옵션",
                    price: null,
                    soldout: false,
                },
            ],
            notices: [],
        };

        return detail;
    }
}

export default async function GoodsDetailPage({
                                                  params,
                                              }: {
    params: { tenant: string; id: string } | Promise<{ tenant: string; id: string }>;
}) {
    const resolved = await Promise.resolve(params);
    const tenant = normalizeTenant(resolved?.tenant);
    const id = String(resolved?.id ?? "").trim();

    if (!tenant || !id) notFound();

    const data = await fetchProductDetail(tenant, id);
    if (!data) notFound();

    return <GoodsDetailClient tenant={tenant} data={data} />;
}