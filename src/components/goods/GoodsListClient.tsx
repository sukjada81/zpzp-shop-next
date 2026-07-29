// src/components/goods/GoodsListClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type RefObject } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDisplayPrice } from "@/lib/price";
import { useInfiniteProducts } from "@/lib/goods/useInfiniteProducts";

export type GoodsListItem = {
    id: string;
    title: string;
    // 비회원 마스킹(§8): 비로그인이면 서버가 price=null + masked=true 로 내림
    price: number | null;
    masked?: boolean;
    badgeLeft?: string;
    badgeRight?: string;
    metaLeft?: string;
    metaRight?: string;
    thumbnailUrl?: string;
    cate?: string | null;
    categoryLabel?: string;
};

// 노출 플랜B: '전체'(진열 전체) 탭 신설·기본화. today/ongoing은 유지(공구 딜 생기면 동작).
// 줍줍은 배송 전용, 정책 변경 대비 보존 — 픽업 탭 노출만 제거(필터 로직·타입은 유지)
const TABS = [
    { key: "all", label: "전체" },
    { key: "today", label: "오늘의 공구" },
    // { key: "pickup", label: "바로 픽업 가능" },
    { key: "ongoing", label: "진행 중인 공구" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function isTabKey(x: string | null): x is TabKey {
    return !!x && (TABS as readonly { key: string }[]).some((t) => t.key === x);
}

function displayCategoryLabel(label?: string) {
    if (label === "오늘의 공구") return "오늘의 공구";
    // 줍줍은 배송 전용, 정책 변경 대비 보존 — "바로 픽업 가능" 카테고리 배지는 노출하지 않음
    if (label === "바로 픽업 가능") return undefined;
    return label;
}

function categoryBadgeColor(label?: string) {
    if (label === "오늘의 공구") {
        return "bg-amber-500 text-white";
    }
    if (label === "바로 픽업 가능") {
        return "bg-sky-500 text-white";
    }
    return "bg-slate-700 text-white";
}

export default function GoodsListClient(props: {
    tenant: string;
    initialItems: GoodsListItem[];
    /** 무한 스크롤 — SSR 첫 페이지 뒤에 더 있는지 */
    initialHasMore?: boolean;
    pageSize?: number;
    /** SSR 첫 페이지와 같은 조건이어야 다음 페이지 offset 이 어긋나지 않는다 */
    listType?: "today" | "ongoing";
    listQuery?: string;
}) {
    const { tenant, initialItems, initialHasMore, pageSize, listType, listQuery } = props;
    const router = useRouter();
    const sp = useSearchParams();

    const tabFromUrl = sp?.get("tab");
    const [q, setQ] = useState("");
    const [tab, setTab] = useState<TabKey>(isTabKey(tabFromUrl) ? tabFromUrl : "all");

    // 무한 스크롤: 아래 filtered 는 이 items(SSR 첫 페이지 + 추가 로드분) 위에서 돈다.
    // 추가 로드분도 서버가 내려준 price/masked 를 그대로 쓰므로 비회원 마스킹이 유지된다.
    const {
        items,
        hasMore,
        loading: loadingMore,
        error: loadMoreError,
        retry: retryLoadMore,
        sentinelRef,
    } = useInfiniteProducts({
        tenant,
        initialItems,
        initialHasMore: !!initialHasMore,
        pageSize: pageSize ?? 20,
        type: listType,
        q: listQuery,
    });

    useEffect(() => {
        const t = sp?.get("tab");
        if (isTabKey(t)) setTab(t);
    }, [sp]);

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();

        const tabFilter = (it: GoodsListItem) => {
            const cate = String(it.cate ?? "").trim();
            const categoryLabel = String(displayCategoryLabel(it.categoryLabel) ?? "").trim();

            // 노출 플랜B: '전체'는 진열된 모든 상품 노출(클라 필터 없음)
            if (tab === "all") {
                return true;
            }

            if (tab === "today") {
                return cate === "100000" || categoryLabel === "오늘의 공구";
            }

            // 줍줍은 배송 전용, 정책 변경 대비 보존 — 픽업 탭 필터 비활성
            // if (tab === "pickup") {
            //     return cate === "100001" || categoryLabel === "바로 픽업 가능";
            // }

            if (tab === "ongoing") {
                return true;
            }

            return true;
        };

        return (items ?? [])
            .filter(tabFilter)
            .filter((it) => (qq ? (it.title ?? "").toLowerCase().includes(qq) : true));
    }, [items, q, tab]);

    // 노출 플랜B: '전체' 헤더 문구 추가. 줍줍은 배송 전용 — 픽업 헤더 분기는 비활성 유지
    const headerTitle =
        tab === "today" ? "오늘의 공구" : tab === "ongoing" ? "진행 중인 공구" : "전체 상품";

    const headerDesc =
        tab === "today"
            ? "오늘의 공구만 모아서 볼 수 있어요."
            : tab === "ongoing"
                ? "현재 예약 가능한 공동구매 상품입니다."
                : "이 스토어에 진열된 상품을 모두 볼 수 있어요.";

    function onChangeTab(next: TabKey) {
        setTab(next);
        router.replace(`/${tenant}/goods?tab=${next}`);
    }

    return (
        <main className="goods-page mx-auto w-full max-w-[1200px] px-4 pb-24 md:px-6 lg:px-8">
            <section className="pt-4 md:pt-6">
                <div className="flex items-start gap-3">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        aria-label="뒤로가기"
                        className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[color:var(--border)] bg-white active:scale-[0.98]"
                    >
                        <span className="text-[18px] font-black text-[color:var(--brand)]">←</span>
                    </button>

                    <div className="min-w-0">
                        <div className="text-[22px] font-extrabold tracking-tight text-[color:var(--fg)] md:text-[30px]">
                            {headerTitle}
                        </div>
                        <div className="mt-1 text-[13px] font-semibold leading-snug text-[color:var(--muted)] md:text-[15px]">
                            {headerDesc}
                        </div>
                    </div>
                </div>
            </section>

            <section className="mt-4 md:mt-6">
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {TABS.map((t) => {
                        const active = t.key === tab;
                        return (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => onChangeTab(t.key)}
                                className={[
                                    "shrink-0 rounded-full px-4 py-2 text-sm font-extrabold transition",
                                    active
                                        ? "bg-[color:var(--brand)] text-white"
                                        : "border border-[color:var(--border)] bg-white text-[color:var(--muted)]",
                                ].join(" ")}
                            >
                                {t.label}
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="mt-4">
                <div className="rounded-2xl border border-[color:var(--border)] bg-white p-3 shadow-sm md:p-4">
                    <div className="flex items-center gap-2">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="상품명을 검색해보세요"
                            className="h-11 flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm outline-none"
                        />

                        {q ? (
                            <button
                                type="button"
                                onClick={() => setQ("")}
                                className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--muted)] hover:bg-[color:var(--accent-soft)]"
                            >
                                지우기
                            </button>
                        ) : null}
                    </div>
                </div>
            </section>

            <section className="mt-5 md:mt-7">
                {filtered.length === 0 ? (
                    <div className="rounded-2xl border border-[color:var(--border)] bg-white p-6 text-center shadow-sm">
                        <div className="text-[15px] font-extrabold text-[color:var(--fg)]">상품이 없습니다</div>
                        <div className="mt-2 text-xs font-semibold text-[color:var(--muted)]">
                            조건에 맞는 상품이 없어요.
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
                        {filtered.map((it) => (
                            <GoodsCard key={it.id} tenant={tenant} item={it} />
                        ))}
                    </div>
                )}

                {/* 무한 스크롤 감시 지점 — 목록이 비어 있어도(검색 필터로 다 걸러져도)
                    다음 페이지를 계속 당겨오도록 항상 렌더한다. */}
                <InfiniteScrollFooter
                    sentinelRef={sentinelRef}
                    hasMore={hasMore}
                    loading={loadingMore}
                    error={loadMoreError}
                    onRetry={retryLoadMore}
                    showEnd={filtered.length > 0}
                />
            </section>
        </main>
    );
}

export function InfiniteScrollFooter(props: {
    sentinelRef: RefObject<HTMLDivElement | null>;
    hasMore: boolean;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
    showEnd?: boolean;
}) {
    const { sentinelRef, hasMore, loading, error, onRetry, showEnd } = props;

    return (
        <div className="mt-6">
            <div ref={sentinelRef} aria-hidden className="h-px w-full" />

            {loading ? (
                <div className="py-4 text-center text-xs font-bold text-[color:var(--muted)]">
                    상품을 불러오는 중…
                </div>
            ) : null}

            {error ? (
                <div className="py-4 text-center">
                    <div className="text-xs font-bold text-[color:var(--muted)]">{error}</div>
                    <button
                        type="button"
                        onClick={onRetry}
                        className="mt-2 rounded-xl border border-[color:var(--border)] bg-white px-4 py-2 text-xs font-extrabold text-[color:var(--brand)]"
                    >
                        다시 시도
                    </button>
                </div>
            ) : null}

            {!hasMore && !loading && !error && showEnd ? (
                <div className="py-4 text-center text-xs font-semibold text-[color:var(--muted)]">
                    모든 상품을 확인했어요.
                </div>
            ) : null}
        </div>
    );
}

function GoodsCard(props: { tenant: string; item: GoodsListItem }) {
    const { tenant, item } = props;
    const thumb = item.thumbnailUrl?.trim();
    const categoryLabel = displayCategoryLabel(item.categoryLabel);

    return (
        <Link
            href={`/${tenant}/goods/${item.id}`}
            className="group block overflow-hidden rounded-[20px] border border-[color:var(--border)] bg-white shadow-sm transition duration-200 hover:-translate-y-[1px] hover:shadow-md"
        >
            <div className="relative overflow-hidden bg-white">
                <div className="aspect-[3/4]" />

                {thumb ? (
                    <div className="absolute inset-0 flex items-center justify-center p-2">
                        <img
                            src={thumb}
                            alt={item.title}
                            className="max-h-full max-w-full object-contain transition duration-300 group-hover:scale-[1.02]"
                            loading="lazy"
                        />
                    </div>
                ) : null}

                <div className="absolute left-3 top-3 flex gap-2">
                    {categoryLabel ? (
                        <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold md:text-[12px] ${categoryBadgeColor(
                                categoryLabel
                            )}`}
                        >
                            {categoryLabel}
                        </span>
                    ) : null}
                </div>
            </div>

            <div className="p-3 md:p-4">
                <div className="line-clamp-2 min-h-[40px] text-[14px] font-bold leading-[1.45] text-[color:var(--fg)] md:min-h-[48px] md:text-[16px]">
                    {item.title}
                </div>

                <div className="mt-2 text-[18px] font-extrabold text-[color:var(--fg)] md:text-[22px]">
                    {formatDisplayPrice(item.price, item.masked)}
                </div>

                {(item.metaLeft || item.metaRight) && (
                    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-semibold leading-[1.4] text-[color:var(--muted)] md:text-[12px]">
                        {item.metaLeft ? <span className="whitespace-nowrap">{item.metaLeft}</span> : null}
                        {item.metaRight ? <span className="whitespace-nowrap">{item.metaRight}</span> : null}
                    </div>
                )}

                <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-center text-xs font-bold text-[color:var(--brand)] transition group-hover:bg-[color:var(--accent-soft)] md:py-3 md:text-sm">
                    자세히 보기 →
                </div>
            </div>
        </Link>
    );
}