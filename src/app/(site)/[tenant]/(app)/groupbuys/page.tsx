// src/app/(site)/[tenant]/(app)/groupbuys/page.tsx
import { notFound } from "next/navigation";
import { normalizeTenant } from "@/lib/tenant/getTenant";
import { endpoints } from "@/lib/api/endpoints";
import OngoingGroupBuySection, { type OngoingGroupBuyItem } from "@/components/home/OngoingGroupBuySection";
import type { RecentOrderTickerItem } from "@/components/home/RecentOrderTicker";
import type { PublicProductsResponse, PublicProductListItem, PublicProductDetailResponse } from "@/lib/types/goods";

// ─── 더미 데이터 (API 연동 전 개발/테스트용) ─────────────────────────────────
// TODO: 아래 DUMMY_ITEMS를 제거하고 fetchOngoingItems()의 실데이터로 교체
const DUMMY_ITEMS: Omit<OngoingGroupBuyItem, "tenant">[] = [
    {
        id: "demo-1",
        title: "[4/22] 니생강 캡슐티",
        price: 12500,
        href: undefined,
        images: [
            { key: "https://picsum.photos/seed/ginger1/400/400", label: "니생강 캡슐티 1" },
            { key: "https://picsum.photos/seed/ginger2/400/400", label: "니생강 캡슐티 2" },
            { key: "https://picsum.photos/seed/ginger3/400/400", label: "니생강 캡슐티 3" },
        ],
        options: [
            {
                id: "opt-1-1",
                name: "니생강 캡슐티",
                price: 12500,
                soldout: false,
                rawOptionId: 0,
                stockNote: "전량 한정! 조기 마감될 수 있습니다.",
            },
        ],
        meta: {
            deadlineAt: new Date(Date.now() + 13 * 60 * 60 * 1000).toISOString(),
            pickup: "픽업일: 04/28(화) ~ 04/29(수)",
        },
        recentOrders: [
            { id: "r1", maskedName: "매****6", minutesAgo: 1, qty: 1 },
            { id: "r2", maskedName: "김****1", minutesAgo: 8, qty: 2 },
            { id: "r3", maskedName: "박****3", minutesAgo: 15, qty: 3 },
        ],
    },
    {
        id: "demo-2",
        title: "[4/23] Stain Remover 얼룩 제거제",
        price: 3200,
        href: undefined,
        images: [
            { key: "https://picsum.photos/seed/stain1/400/400", label: "Stain Remover 1" },
            { key: "https://picsum.photos/seed/stain2/400/400", label: "Stain Remover 2" },
        ],
        options: [
            {
                id: "opt-2-1",
                name: "Stain Remover 300ml",
                price: 3200,
                soldout: false,
                rawOptionId: 0,
            },
            {
                id: "opt-2-2",
                name: "Stain Remover 500ml",
                price: 4800,
                soldout: false,
                rawOptionId: 0,
            },
        ],
        meta: {
            deadlineAt: new Date(Date.now() + 27 * 60 * 60 * 1000).toISOString(),
            pickup: "픽업일: 04/29(수) ~ 04/30(목)",
        },
        recentOrders: [
            { id: "r4", maskedName: "중****7", minutesAgo: 13, qty: 2 },
            { id: "r5", maskedName: "이****9", minutesAgo: 22, qty: 1 },
        ],
    },
];

// ─── Data fetching ────────────────────────────────────────────────────────────

function getInternalOrigin() {
    return process.env.NEXT_INTERNAL_ORIGIN || process.env.NEXT_PUBLIC_BASE_URL || "http://127.0.0.1:3000";
}

async function fetchRecentOrders(tenant: string): Promise<RecentOrderTickerItem[]> {
    try {
        const origin = getInternalOrigin();
        const url = new URL(endpoints.publicRecentOrders(tenant, { take: 10 }), origin);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) return [];
        const data = await res.json().catch(() => null);
        if (!data?.ok || !Array.isArray(data.items)) return [];
        return data.items as RecentOrderTickerItem[];
    } catch {
        return [];
    }
}

function toAbsUrl(key?: string) {
    const k = String(key ?? "").trim();
    if (!k) return "";
    if (/^https?:\/\//i.test(k)) return k;
    const base = (process.env.NEXT_PUBLIC_ASSET_ORIGIN || "").replace(/\/$/, "");
    return base ? `${base}${k.startsWith("/") ? "" : "/"}${k}` : k.startsWith("/") ? k : `/${k}`;
}

async function fetchProductDetail(
    tenant: string,
    id: string | number
): Promise<PublicProductDetailResponse["product"] | null> {
    try {
        const origin = getInternalOrigin();
        const url = new URL(endpoints.publicProductDetail(tenant, id), origin);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) return null;
        const data = (await res.json().catch(() => null)) as PublicProductDetailResponse | null;
        return data?.product ?? null;
    } catch {
        return null;
    }
}

function mapProductToItem(
    p: PublicProductListItem,
    tenant: string,
    recentOrders: RecentOrderTickerItem[],
    detail: PublicProductDetailResponse["product"] | null
): OngoingGroupBuyItem {
    // 이미지: 상세 API > 목록 API images[] > thumbnailUrl 순으로 폴백
    const rawImages =
        Array.isArray(detail?.images) && detail.images.length
            ? detail.images
            : Array.isArray(p.images) && p.images.length
                ? p.images
                : null;

    const images = rawImages
        ? rawImages.map((img) => ({ key: toAbsUrl(img.key), label: img.label }))
        : p.thumbnailUrl
            ? [{ key: toAbsUrl(p.thumbnailUrl), label: p.title }]
            : [{ key: "", label: "이미지 없음" }];

    // 옵션: 상세 API > 목록 API 순으로 폴백
    const rawOptions =
        Array.isArray(detail?.options) && detail.options.length
            ? detail.options
            : Array.isArray(p.options) && p.options.length
                ? p.options
                : [];

    const options = rawOptions.map((o) => ({
        id: String(o.id),
        name: String(o.name ?? ""),
        price: o.price === null || o.price === undefined ? null : Number(o.price),
        addPrice: o.addPrice === undefined ? undefined : Number(o.addPrice),
        qty: o.qty === undefined ? undefined : Number(o.qty),
        qtyType: o.qtyType === undefined ? undefined : Number(o.qtyType),
        soldout: !!o.soldout,
        stockNote: o.stockNote,
        rawOptionId: o.rawOptionId,
        code: o.code,
    }));

    return {
        id: String(p.id),
        tenant,
        title: String(p.title ?? ""),
        price: Number(p.price ?? 0),
        href: `/${tenant}/goods/${p.id}`,
        images,
        options,
        meta: {
            deadlineAt: p.saleEndAt ?? null,
            timeLeft: p.metaLeft ?? undefined,
            pickup: p.metaRight ?? undefined,
            pickupStartAt: p.pickupStartAt ?? null,
            pickupEndAt: p.pickupEndAt ?? null,
        },
        recentOrders,
    };
}

async function fetchOngoingItems(tenant: string): Promise<OngoingGroupBuyItem[] | null> {
    // TODO: API가 ongoing 타입을 지원하면 실데이터 반환, 아직 미지원이면 null 반환 → 더미 데이터 표시
    try {
        const origin = getInternalOrigin();
        const url = new URL(endpoints.publicOngoingProducts(tenant, { take: 20 }), origin);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) return null;

        const data = (await res.json().catch(() => null)) as PublicProductsResponse | null;
        if (!data?.ok || !Array.isArray(data.items) || !data.items.length) return null;

        const [recentOrders, details] = await Promise.all([
            fetchRecentOrders(tenant),
            Promise.all(data.items.map((p) => fetchProductDetail(tenant, p.id))),
        ]);

        return data.items.map((p, i) => mapProductToItem(p, tenant, recentOrders, details[i] ?? null));
    } catch {
        return null;
    }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GroupBuysPage({
    params,
}: {
    params: { tenant: string } | Promise<{ tenant: string }>;
}) {
    const resolved = await Promise.resolve(params);
    const tenant = normalizeTenant(resolved?.tenant);
    if (!tenant) notFound();

    // 실 API 먼저 시도 → 결과 없으면 더미 데이터 사용
    const apiItems = await fetchOngoingItems(tenant);
    const items: OngoingGroupBuyItem[] =
        apiItems ??
        DUMMY_ITEMS.map((item) => ({
            ...item,
            tenant,
            href: item.href ?? `/${tenant}/goods/${item.id}`,
        }));

    return (
        <main className="mx-auto w-full max-w-[520px] px-4 pb-28 pt-4">
            <OngoingGroupBuySection items={items} />
        </main>
    );
}
