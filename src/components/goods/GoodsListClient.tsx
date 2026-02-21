// src/components/goods/GoodsListClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type GoodsListItem = {
    id: string;
    title: string;
    price: number;
    badgeLeft?: string;
    badgeRight?: string;
    metaLeft?: string;
    metaRight?: string;
};

const CATEGORIES = [
    { key: "water", label: "정수기", icon: "💧" },
    { key: "internet", label: "인터넷", icon: "📶" },
    { key: "flower", label: "졸업축하", icon: "💐" },
    { key: "hwahwan", label: "화환", icon: "🟢" },
    { key: "move", label: "이사", icon: "🚚" },
    { key: "phone", label: "핸드폰", icon: "📱" },
    { key: "trip", label: "여행", icon: "🧳" },
];

const TABS = [
    { key: "today", label: "오늘의 공구" },
    { key: "limited", label: "오늘의 한정특가" },
    { key: "event", label: "이벤트" },
];

export default function GoodsListClient(props: {
    tenant: string;
    initialItems: GoodsListItem[];
}) {
    const { tenant, initialItems } = props;

    const [q, setQ] = useState("");
    const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("today");
    const [pickedCat, setPickedCat] = useState<string | null>(null);

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();

        const tabFilter = (it: GoodsListItem) => {
            if (tab === "today") return true;
            if (tab === "limited") return (it.badgeRight ?? "").includes("한정") || it.title.includes("한정");
            if (tab === "event") return (it.badgeLeft ?? "").includes("이벤트") || it.title.includes("이벤트");
            return true;
        };

        const catFilter = (it: GoodsListItem) => {
            if (!pickedCat) return true;
            const map: Record<string, string[]> = {
                water: ["정수기"],
                internet: ["인터넷"],
                flower: ["졸업", "축하"],
                hwahwan: ["화환"],
                move: ["이사"],
                phone: ["핸드폰", "폰"],
                trip: ["여행", "오션", "제주", "강릉", "태안"],
            };
            const keys = map[pickedCat] ?? [];
            return keys.some((k) => it.title.includes(k));
        };

        return initialItems
            .filter(tabFilter)
            .filter(catFilter)
            .filter((it) => (qq ? it.title.toLowerCase().includes(qq) : true));
    }, [initialItems, q, tab, pickedCat]);

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24">
            {/* 검색 */}
            <div className="pt-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-400">🔎</span>
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="검색어를 입력해 주세요"
                            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                        />
                        {q ? (
                            <button
                                type="button"
                                onClick={() => setQ("")}
                                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                            >
                                지우기
                            </button>
                        ) : null}
                    </div>
                </div>

                {/* 탭 */}
                <div className="mt-3 flex gap-2">
                    {TABS.map((t) => {
                        const active = tab === t.key;
                        return (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setTab(t.key)}
                                className={[
                                    "rounded-full border px-4 py-2 text-sm font-bold transition",
                                    active
                                        ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-white"
                                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                                ].join(" ")}
                            >
                                {t.label}
                            </button>
                        );
                    })}
                </div>

                {/* 아이콘 카테고리 */}
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="grid grid-cols-7 gap-2">
                        {CATEGORIES.map((c) => {
                            const active = pickedCat === c.key;
                            return (
                                <button
                                    key={c.key}
                                    type="button"
                                    onClick={() => setPickedCat(active ? null : c.key)}
                                    className="flex flex-col items-center gap-2"
                                >
                                    <div
                                        className={[
                                            "grid h-11 w-11 place-items-center rounded-2xl border text-lg",
                                            active
                                                ? "border-[color:var(--brand)] bg-[color:var(--brand-weak)]"
                                                : "border-slate-200 bg-slate-50",
                                        ].join(" ")}
                                    >
                                        <span>{c.icon}</span>
                                    </div>
                                    <div className="text-[11px] font-semibold text-slate-700">{c.label}</div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-600">
                        공구 클릭시 상세내용 확인 가능합니다.
                    </div>
                </div>
            </div>

            {/* 리스트 헤더 */}
            <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🛒</span>
                    <div className="text-lg font-extrabold text-slate-900">상품 목록</div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
            {filtered.length}
          </span>
                </div>

                <Link href={`/${tenant}/home`} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
                    홈으로 →
                </Link>
            </div>

            {/* 그리드 */}
            <div className="mt-3 grid grid-cols-2 gap-3">
                {filtered.map((it) => (
                    <GoodsCard key={it.id} tenant={tenant} item={it} />
                ))}
            </div>
        </main>
    );
}

function GoodsCard(props: { tenant: string; item: GoodsListItem }) {
    const { tenant, item } = props;

    return (
        <Link
            href={`/${tenant}/goods/${item.id}`}
            className="group block rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
        >
            <div className="p-3">
                {/* 썸네일 자리 */}
                <div className="relative overflow-hidden rounded-xl bg-slate-100">
                    <div className="aspect-[4/3]" />

                    {/* 배지 */}
                    <div className="absolute left-2 top-2 flex gap-2">
                        {item.badgeLeft ? (
                            <span className="rounded-full bg-[color:var(--brand)] px-2 py-1 text-[11px] font-extrabold text-white">
                {item.badgeLeft}
              </span>
                        ) : null}
                        {item.badgeRight ? (
                            <span className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-extrabold text-white">
                {item.badgeRight}
              </span>
                        ) : null}
                    </div>

                    {/* ✅ 하단 라벨(DAICLO) 제거 */}
                </div>

                {/* 타이틀/가격 */}
                <div className="mt-3 line-clamp-2 text-sm font-bold text-slate-900">{item.title}</div>
                <div className="mt-2 text-lg font-extrabold text-slate-900">{item.price.toLocaleString()}원</div>

                {/* 메타 */}
                {(item.metaLeft || item.metaRight) && (
                    <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span>{item.metaLeft ?? ""}</span>
                        <span>{item.metaRight ?? ""}</span>
                    </div>
                )}

                {/* CTA 느낌 */}
                <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-bold text-slate-700 group-hover:bg-slate-50">
                    자세히 보기 →
                </div>
            </div>
        </Link>
    );
}