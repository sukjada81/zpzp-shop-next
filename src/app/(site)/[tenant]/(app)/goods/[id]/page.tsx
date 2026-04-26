// src/app/(site)/[tenant]/(app)/goods/[id]/page.tsx
import { notFound } from "next/navigation";
import GoodsDetailClient, { type GoodsDetailData } from "@/components/goods/GoodsDetailClient";
import { endpoints } from "@/lib/api/endpoints";
import { normalizeTenant } from "@/lib/tenant/getTenant";
import type { PublicProductDetailResponse, PublicProductsResponse } from "@/lib/types/goods";

function getInternalOrigin() {
    return process.env.NEXT_INTERNAL_ORIGIN || process.env.NEXT_PUBLIC_BASE_URL || "http://127.0.0.1:3000";
}

async function fetchProductDetail(tenant: string, id: string): Promise<GoodsDetailData | null> {
    const origin = getInternalOrigin();

    {
        const path = endpoints.publicProductDetail(tenant, id);
        const url = new URL(path, origin);
        const res = await fetch(url.toString(), { cache: "no-store" });

        if (res.ok) {
            const data = (await res.json().catch(() => null)) as PublicProductDetailResponse | null;
            if (data?.ok && data.product) {
                const p = data.product;

                const detail: GoodsDetailData = {
                    id: String(p.id),
                    title: String(p.title ?? ""),
                    price: Number(p.price ?? 0),
                    description: p.description ?? null,
                    badges: (p as any).badges,
                    meta: {
                        timeLeft: p.meta?.timeLeft,
                        pickup: p.meta?.pickup,
                        pickupStartAt: p.meta?.pickupStartAt ?? null,
                        pickupEndAt: p.meta?.pickupEndAt ?? null,
                        pickupNote: p.meta?.pickupNote ?? null,
                    },
                    images: Array.isArray(p.images) && p.images.length
                        ? p.images
                        : [{ key: "", label: "이미지 없음" }],
                    options:
                        Array.isArray(p.options) && p.options.length
                            ? p.options.map((o) => ({
                                id: String(o.id),
                                name: String(o.name ?? ""),
                                price: o.price === null || o.price === undefined ? null : Number(o.price),
                                addPrice:
                                    o.addPrice === null || o.addPrice === undefined
                                        ? undefined
                                        : Number(o.addPrice),
                                qty: o.qty === null || o.qty === undefined ? undefined : Number(o.qty),
                                qtyType:
                                    o.qtyType === null || o.qtyType === undefined
                                        ? undefined
                                        : Number(o.qtyType),
                                soldout: !!o.soldout,
                                stockNote: o.stockNote,
                                rawOptionId: o.rawOptionId,
                                code: o.code,
                            }))
                            : [
                                {
                                    id: "default",
                                    name: String(p.title ?? ""),
                                    price: null,
                                    soldout: false,
                                    rawOptionId: 0,
                                },
                            ],
                    notices: Array.isArray((p as any).notices) ? (p as any).notices : [],
                };

                return detail;
            }
        }
    }

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
                pickupStartAt: found.pickupStartAt ?? null,
                pickupEndAt: found.pickupEndAt ?? null,
                pickupNote: found.pickupNote ?? null,
            },
            images: found.thumbnailUrl
                ? [{ key: found.thumbnailUrl, label: "대표 이미지" }]
                : [{ key: "", label: "이미지 없음" }],
            options: [
                {
                    id: "default",
                    name: String(found.title ?? ""),
                    price: null,
                    soldout: false,
                    rawOptionId: 0,
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