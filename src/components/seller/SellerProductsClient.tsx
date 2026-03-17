// src/components/seller/SellerProductsClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Package, Search } from "lucide-react";
import { getSellerHref } from "@/lib/seller/getSellerHref";

type SellerProductItem = {
    id: string;
    tenant_id: string;
    name: string;
    price: number;
    status: string;
    image: string;
    stock: number;
};

function statusBadge(status: string) {
    const s = (status || "").toLowerCase();

    if (["active", "sale", "selling"].includes(s)) {
        return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    }
    if (["soldout", "sold_out", "outofstock", "out_of_stock"].includes(s)) {
        return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    }
    if (["draft"].includes(s)) {
        return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
    }
    return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
}

export default function SellerProductsClient({ tenant }: { tenant: string }) {
    const [items, setItems] = useState<SellerProductItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");

    useEffect(() => {
        let active = true;

        (async () => {
            try {
                const res = await fetch(`/api/seller/${tenant}/products`, {
                    cache: "no-store",
                    credentials: "include"
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
                item.name.toLowerCase().includes(q) ||
                item.status.toLowerCase().includes(q)
            );
        });
    }, [items, query]);

    return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                        상품 관리
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {tenant} 매장의 상품을 조회하고 상태를 관리합니다.
                    </p>
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 ring-1 ring-slate-200">
                    상품 등록은 관리자페이지에서만 가능합니다.
                </div>
            </div>

            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="상품명 / 상태 검색"
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
                    <Package className="mx-auto h-8 w-8 text-slate-400" />
                    <div className="mt-3 text-sm font-semibold text-slate-700">
                        표시할 상품이 없습니다.
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                        상품은 관리자페이지에서 등록 후 이 화면에서 관리할 수 있습니다.
                    </div>
                </div>
            ) : (
                <div className="grid gap-3">
                    {filtered.map((item) => (
                        <Link
                            key={item.id}
                            href={getSellerHref(tenant, `/products/${item.id}`)}
                            className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-[1px] hover:shadow-md"
                        >
                            <div className="h-20 w-20 overflow-hidden rounded-2xl bg-slate-100">
                                {item.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={item.image}
                                        alt={item.name}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                                        NO IMAGE
                                    </div>
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="truncate text-base font-bold tracking-[-0.02em] text-slate-900">
                                    {item.name}
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(item.status)}`}>
                                        {item.status || "draft"}
                                    </span>
                                    <span className="text-sm text-slate-500">
                                        재고 {item.stock.toLocaleString("ko-KR")}개
                                    </span>
                                </div>

                                <div className="mt-2 text-sm font-semibold text-slate-800">
                                    {item.price.toLocaleString("ko-KR")}원
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}