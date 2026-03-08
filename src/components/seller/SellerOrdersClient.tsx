// src/components/seller/SellerOrdersClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShoppingBag } from "lucide-react";
import { getSellerHref } from "@/lib/seller/getSellerHref";

type SellerOrderItem = {
    id: string;
    orderNo: string;
    buyerName: string;
    amount: number;
    status: string;
    createdAtText: string;
};

function statusBadge(status: string) {
    const s = (status || "").toLowerCase();

    if (["pending", "paid", "ready", "preparing"].includes(s)) {
        return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    }
    if (["completed", "done", "delivered", "picked_up"].includes(s)) {
        return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    }
    if (["canceled", "cancelled", "refund", "refunded"].includes(s)) {
        return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    }
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

export default function SellerOrdersClient({ tenant }: { tenant: string }) {
    const [items, setItems] = useState<SellerOrderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");

    useEffect(() => {
        let active = true;

        (async () => {
            try {
                const res = await fetch(`/api/seller/${tenant}/orders`, {
                    cache: "no-store",
                });
                const json = await res.json();

                if (!active) return;
                setItems(Array.isArray(json?.items) ? json.items : []);
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [tenant]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;

        return items.filter((item) => {
            return (
                item.orderNo.toLowerCase().includes(q) ||
                item.buyerName.toLowerCase().includes(q) ||
                item.status.toLowerCase().includes(q)
            );
        });
    }, [items, query]);

    return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="mb-5">
                <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                    주문 관리
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                    최근 주문을 확인하고 상태를 관리할 수 있습니다.
                </p>
            </div>

            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="주문번호 / 주문자 / 상태 검색"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
            </div>

            {loading ? (
                <div className="grid gap-3">
                    {Array.from({ length: 5 }).map((_, idx) => (
                        <div
                            key={idx}
                            className="h-24 animate-pulse rounded-2xl bg-slate-100"
                        />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                    <ShoppingBag className="mx-auto h-8 w-8 text-slate-400" />
                    <div className="mt-3 text-sm font-semibold text-slate-700">
                        표시할 주문이 없습니다.
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                        주문 데이터가 생성되면 이곳에서 확인할 수 있습니다.
                    </div>
                </div>
            ) : (
                <div className="grid gap-3">
                    {filtered.map((item) => (
                        <Link
                            key={item.id}
                            href={getSellerHref(tenant, `/orders/${item.id}`)}
                            className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-[1px] hover:shadow-md"
                        >
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="min-w-0">
                                    <div className="truncate text-base font-bold tracking-[-0.02em] text-slate-900">
                                        주문번호 {item.orderNo}
                                    </div>
                                    <div className="mt-1 text-sm text-slate-500">
                                        주문자 {item.buyerName}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-400">
                                        {item.createdAtText}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(item.status)}`}>
                                        {item.status || "pending"}
                                    </span>
                                    <span className="text-sm font-bold text-slate-900">
                                        {item.amount.toLocaleString("ko-KR")}원
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}