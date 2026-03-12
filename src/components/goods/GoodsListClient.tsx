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
};

const TABS = [
    { key: "today", label: "오늘의 공구" },
    { key: "pickup", label: "바로 픽업 가능" },
    { key: "ongoing", label: "진행 중인 공구" },
    { key: "limited", label: "오늘의 한정특가" },
    { key: "event", label: "이벤트" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function isTabKey(x: string | null): x is TabKey {
    return !!x && (TABS as readonly { key: string }[]).some((t) => t.key === x);
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
            const left = it.metaLeft ?? "";
            const right = it.metaRight ?? "";
            const title = it.title ?? "";
            const badgeL = it.badgeLeft ?? "";
            const badgeR = it.badgeRight ?? "";

            if (tab === "today") return true;
            if (tab === "pickup") return right.includes("픽업") || title.includes("픽업");

            if (tab === "ongoing") {
                return (
                    badgeL.includes("진행") ||
                    badgeR.includes("진행") ||
                    left.includes("D-") ||
                    right.includes("D-") ||
                    title.includes("진행")
                );
            }

            if (tab === "limited") return badgeR.includes("한정") || title.includes("한정");
            if (tab === "event") return badgeL.includes("이벤트") || title.includes("이벤트");
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
                : tab === "ongoing"
                    ? "진행 중인 공구"
                    : tab === "limited"
                        ? "오늘의 한정특가"
                        : "이벤트";

    const headerDesc = "현재 예약 가능한 공동구매 상품입니다.";

    function onChangeTab(next: TabKey) {
        setTab(next);
        router.replace(`/${tenant}/goods?tab=${next}`);
    }

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24">
            <section className="pt-3">
                <div className="flex items-start gap-3">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        aria-label="뒤로가기"
                        className="mt-1 grid h-9 w-9 place-items-center rounded-xl border border-[color:var(--border)] bg-white active:scale-[0.98]"
                    >
                        <span className="text-[18px] font-black text-[color:var(--brand)]">←</span>
                    </button>

                    <div className="min-w-0">
                        <div className="text-[22px] font-extrabold tracking-tight text-[color:var(--fg)]">{headerTitle}</div>
                        <div className="mt-1 text-[13px] font-semibold text-[color:var(--muted)] leading-snug">{headerDesc}</div>
                    </div>
                </div>
            </section>

            <section className="mt-4">
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {TABS.map((t) => {
                        const active = t.key === tab;
                        return (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => onChangeTab(t.key)}
                                className={[
                                    "shrink-0 rounded-full px-3 py-2 text-xs font-extrabold border",
                                    active
                                        ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]"
                                        : "bg-white text-[color:var(--muted)] border-[color:var(--border)]",
                                ].join(" ")}
                            >
                                {t.label}
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="mt-4">
                <div className="rounded-2xl border border-[color:var(--border)] bg-white px-3 py-2 shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-[color:var(--muted)]">🔎</span>
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="검색어를 입력해 주세요"
                            className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--muted)]"
                        />
                        {q ? (
                            <button
                                type="button"
                                onClick={() => setQ("")}
                                className="rounded-lg px-2 py-1 text-xs font-semibold text-[color:var(--muted)] hover:bg-[color:var(--accent-soft)]"
                            >
                                지우기
                            </button>
                        ) : null}
                    </div>
                </div>
            </section>

            <section className="mt-5">
                {filtered.length === 0 ? (
                    <div className="rounded-2xl border border-[color:var(--border)] bg-white p-6 text-center shadow-sm">
                        <div className="text-[15px] font-extrabold text-[color:var(--fg)]">상품이 없습니다</div>
                        <div className="mt-2 text-xs font-semibold text-[color:var(--muted)]">조건에 맞는 상품이 없어요.</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
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

    // ✅ thumbnailUrl이 절대URL로 오니 그대로 사용
    const thumb = item.thumbnailUrl?.trim();

    return (
        <Link
            href={`/${tenant}/goods/${item.id}`}
            className="group block rounded-2xl border border-[color:var(--border)] bg-white shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
        >
            <div className="p-3">
                <div className="relative overflow-hidden rounded-xl bg-[color:var(--brand-soft)]">
                    <div className="aspect-[4/3]" />

                    {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={thumb}
                            alt={item.title}
                            className="absolute inset-0 h-full w-full object-cover"
                            loading="lazy"
                        />
                    ) : null}

                    <div className="absolute left-2 top-2 flex gap-2">
                        {item.badgeLeft ? (
                            <span className="rounded-full bg-[color:var(--brand)] px-2 py-1 text-[11px] font-extrabold text-white">
                {item.badgeLeft}
              </span>
                        ) : null}
                        {item.badgeRight ? (
                            <span className="rounded-full bg-[color:var(--accent)] px-2 py-1 text-[11px] font-extrabold text-white">
                {item.badgeRight}
              </span>
                        ) : null}
                    </div>
                </div>

                <div className="mt-3 line-clamp-2 text-sm font-bold text-[color:var(--fg)]">{item.title}</div>
                <div className="mt-2 text-lg font-extrabold text-[color:var(--fg)]">{Number(item.price ?? 0).toLocaleString()}원</div>

                {(item.metaLeft || item.metaRight) && (
                    <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-[color:var(--muted)]">
                        <span>{item.metaLeft ?? ""}</span>
                        <span>{item.metaRight ?? ""}</span>
                    </div>
                )}

                <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-center text-xs font-bold text-[color:var(--brand)] group-hover:bg-[color:var(--accent-soft)]">
                    자세히 보기 →
                </div>
            </div>
        </Link>
    );
}