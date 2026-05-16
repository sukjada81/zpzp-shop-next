// src/components/goods/GoodsListClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type GoodsListItem = {
    id: string;
    title: string;
    price: number;
    badgeLeft?: string;
    badgeRight?: string;
    metaLeft?: string;
    metaRight?: string;
    thumbnailUrl?: string;
    cate?: string | null;
    categoryLabel?: string;
};

const TABS = [
    { key: "today", label: "오늘의 공구" },
    { key: "pickup", label: "바로 픽업 가능" },
    { key: "ongoing", label: "진행 중인 공구" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function isTabKey(x: string | null): x is TabKey {
    return !!x && (TABS as readonly { key: string }[]).some((t) => t.key === x);
}

function displayCategoryLabel(label?: string) {
    if (label === "오늘의 공구") return "오늘의 공구";
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

export default function GoodsListClient(props: { tenant: string; initialItems: GoodsListItem[] }) {
    const { tenant, initialItems } = props;
    const router = useRouter();
    const sp = useSearchParams();

    const tabFromUrl = sp?.get("tab");
    const [q, setQ] = useState("");
    const [tab, setTab] = useState<TabKey>(isTabKey(tabFromUrl) ? tabFromUrl : "today");

    useEffect(() => {
        const t = sp?.get("tab");
        if (isTabKey(t)) setTab(t);
    }, [sp]);

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();

        const tabFilter = (it: GoodsListItem) => {
            const cate = String(it.cate ?? "").trim();
            const categoryLabel = String(displayCategoryLabel(it.categoryLabel) ?? "").trim();

            if (tab === "today") {
                return cate === "100000" || categoryLabel === "오늘의 공구";
            }

            if (tab === "pickup") {
                return cate === "100001" || categoryLabel === "바로 픽업 가능";
            }

            if (tab === "ongoing") {
                return true;
            }

            return true;
        };

        return (initialItems ?? [])
            .filter(tabFilter)
            .filter((it) => (qq ? (it.title ?? "").toLowerCase().includes(qq) : true));
    }, [initialItems, q, tab]);

    const headerTitle =
        tab === "today"
            ? "오늘의 공구"
            : tab === "pickup"
                ? "바로 픽업 가능"
                : "진행 중인 공구";

    const headerDesc =
        tab === "today"
            ? "오늘의 공구만 모아서 볼 수 있어요."
            : tab === "pickup"
                ? "바로 픽업 가능한 상품만 볼 수 있어요."
                : "현재 예약 가능한 공동구매 상품입니다.";

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
            </section>
        </main>
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
                    {Number(item.price ?? 0).toLocaleString()}원
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