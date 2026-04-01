// src/components/goods/GoodsCard.tsx
"use client";

import Link from "next/link";
import type { GoodsListItem } from "@/components/goods/GoodsListClient";

export default function GoodsCard(props: { tenant: string; item: GoodsListItem }) {
    const { tenant, item } = props;

    return (
        <Link
            href={`/${tenant}/goods/${item.id}`}
            className="group block rounded-2xl border border-[color:var(--border)] bg-white shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
        >
            <div className="p-3">
                <div className="relative overflow-hidden rounded-xl bg-white">
                    <div className="aspect-[4/3]" />

                    {item.thumbnailUrl ? (
                        <div className="absolute inset-0 flex items-center justify-center p-2">
                            <img
                                src={item.thumbnailUrl}
                                alt={item.title}
                                className="max-h-full max-w-full object-contain"
                                loading="lazy"
                            />
                        </div>
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