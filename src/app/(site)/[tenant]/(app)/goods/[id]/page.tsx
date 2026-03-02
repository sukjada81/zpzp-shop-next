// src/app/(site)/[tenant]/(app)/goods/[id]/page.tsx
import { notFound } from "next/navigation";
import GoodsDetailClient, { type GoodsDetailData } from "@/components/goods/GoodsDetailClient";

type ProductDetailResponse = {
    ok: true;
    tenant?: string;
    product: {
        id: string | number;
        title: string;
        price: number;
        description?: string | null;
        badges?: { left?: string; right?: string };
        meta?: { timeLeft?: string; pickup?: string };
        images?: { key: string; label?: string }[];
        options?: Array<{
            id: string | number;
            name: string;
            price: number | null;
            soldout?: boolean;
            stockNote?: string;
        }>;
        notices?: { icon?: string; text: string }[];
    };
};

function normalizeTenant(raw: string) {
    const t = (raw || "").toLowerCase().trim();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

function getBaseUrl() {
    return (
        process.env.NEXT_PUBLIC_BASE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    );
}

/**
 * ✅ 1순위: 백엔드에 상세 API가 있으면 그걸 사용
 * - /v1/public/products/:id 형태로 먼저 시도
 * ✅ 2순위: 없으면(not ok) 목록 API로 fallback해서 최소 상세 데이터 구성
 */
async function fetchProductDetail(tenant: string, id: string): Promise<GoodsDetailData | null> {
    const baseUrl = getBaseUrl();

    // 1) 상세 API 시도
    {
        const url = new URL(`/api/proxy/${tenant}/v1/public/products/${id}`, baseUrl);
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

    // 2) fallback: 목록 API에서 찾아서 최소 상세 구성
    {
        type PublicProductsResponse = {
            ok: true;
            tenant: string;
            items: Array<{
                id: string | number;
                title: string;
                price: number;
                metaLeft?: string;
                metaRight?: string;
            }>;
        };

        const url = new URL(`/api/proxy/${tenant}/v1/public/products`, baseUrl);
        url.searchParams.set("take", "200");

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
    // ✅ Next.js 16: params Promise 케이스 대응
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