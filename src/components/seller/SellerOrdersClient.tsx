// src/components/seller/SellerOrdersClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
    CalendarDays,
    CheckCircle2,
    Loader2,
    Package2,
    Search,
    ShoppingBag,
    Tag,
} from "lucide-react";
import { getSellerHref } from "@/lib/seller/getSellerHref";

type SellerOrderLine = {
    productName?: string;
    goodsName?: string;
    name?: string;
    optionName?: string;
    optionValue?: string;
    quantity?: number;
    qty?: number;
    categoryName?: string;
    categoryLabel?: string;
    category?: string;
    cate?: string | number;
    pickupDate?: string;
    pickupAt?: string;
    pickup_at?: string;
    pickupOnly?: boolean;
    pickup_only?: boolean;
    tab?: string;
    groupType?: string;
};

type SellerOrderItem = {
    id: string;
    orderNo: string;
    buyerName: string;
    amount: number;
    status: number;
    canCancel?: boolean;
    createdAtText: string;
    itemSummary?: string;
    orderSummary?: string;
    productName?: string;
    goodsName?: string;
    itemNames?: string[];
    saleEndAtText?: string | null;
    pickupStartAtText?: string | null;
    pickupEndAtText?: string | null;
    items?: SellerOrderLine[];
};

function getStatusLabel(status?: number) {
    switch (status) {
        case 0:
            return "주문접수";
        case 1:
            return "현장결제완료";
        case 2:
            return "픽업준비완료";
        case 4:
            return "픽업완료";
        case 9:
            return "주문취소";
        default:
            return "알수없음";
    }
}

function statusBadge(status?: number) {
    if ([0, 1, 2].includes(Number(status))) {
        return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    }
    if (Number(status) === 4) {
        return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    }
    if (Number(status) === 9) {
        return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    }
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function normalizeText(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function getLineLabel(line: SellerOrderLine) {
    const name =
        normalizeText(line.productName) ||
        normalizeText(line.goodsName) ||
        normalizeText(line.name);

    const option =
        normalizeText(line.optionName) ||
        normalizeText(line.optionValue);

    const qty = Number(line.quantity ?? line.qty ?? 0);

    if (!name) return "";

    if (option && qty > 0) return `${name} / ${option} × ${qty}`;
    if (option) return `${name} / ${option}`;
    if (qty > 0) return `${name} × ${qty}`;
    return name;
}

function getOrderSummary(item: SellerOrderItem) {
    const directSummary =
        normalizeText(item.itemSummary) ||
        normalizeText(item.orderSummary) ||
        normalizeText(item.productName) ||
        normalizeText(item.goodsName);

    if (directSummary) return directSummary;

    if (Array.isArray(item.itemNames) && item.itemNames.length > 0) {
        const cleaned = item.itemNames
            .map((v) => normalizeText(v))
            .filter(Boolean);

        if (cleaned.length === 1) return cleaned[0];
        if (cleaned.length > 1) {
            return `${cleaned[0]} 외 ${cleaned.length - 1}건`;
        }
    }

    if (Array.isArray(item.items) && item.items.length > 0) {
        const labels = item.items.map(getLineLabel).filter(Boolean);

        if (labels.length === 1) return labels[0];
        if (labels.length > 1) {
            return `${labels[0]} 외 ${labels.length - 1}건`;
        }
    }

    return "";
}

function getCategoryLabel(item: SellerOrderItem) {
    const first = item.items?.[0];
    return (
        normalizeText(first?.categoryLabel) ||
        normalizeText(first?.categoryName) ||
        normalizeText(first?.category) ||
        ""
    );
}

function getPickupDate(item: SellerOrderItem) {
    const first = item.items?.[0];
    return (
        normalizeText(first?.pickupDate) ||
        normalizeText(first?.pickupAt) ||
        normalizeText(first?.pickup_at) ||
        ""
    );
}

function getGroupBadge(item: SellerOrderItem) {
    const first = item.items?.[0];

    if (first?.pickupOnly || first?.pickup_only) return "바로픽업";

    const tab = normalizeText(first?.tab).toLowerCase();
    const groupType = normalizeText(first?.groupType).toLowerCase();

    if (tab === "today" || groupType === "today") return "오늘의 공구";
    if (tab === "ongoing" || groupType === "ongoing") return "진행중 공구";

    return "";
}

export default function SellerOrdersClient({ tenant }: { tenant: string }) {
    const searchParams = useSearchParams();
    const initialQuery = (searchParams.get("query") || "").trim();

    const [items, setItems] = useState<SellerOrderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState(initialQuery);
    const [savingId, setSavingId] = useState<string | null>(null);

    useEffect(() => {
        setQuery(initialQuery);
    }, [initialQuery]);

    async function load() {
        const res = await fetch(`/api/seller/${tenant}/orders`, {
            cache: "no-store",
            credentials: "include",
        });

        const json = await res.json().catch(() => null);
        setItems(Array.isArray(json?.items) ? json.items : []);
    }

    useEffect(() => {
        let active = true;

        (async () => {
            try {
                const res = await fetch(`/api/seller/${tenant}/orders`, {
                    cache: "no-store",
                    credentials: "include",
                });
                const json = await res.json().catch(() => null);

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

    async function handleConfirm(orderId: string) {
        try {
            setSavingId(orderId);

            const res = await fetch(`/api/seller/${tenant}/orders/${orderId}/status`, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "content-type": "application/json",
                    accept: "application/json",
                },
                body: JSON.stringify({ status: 4 }),
            });

            const json = await res.json().catch(() => null);

            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || "픽업완료 처리에 실패했습니다.");
            }

            await load();
        } catch (e: any) {
            alert(e?.message || "픽업완료 처리에 실패했습니다.");
        } finally {
            setSavingId(null);
        }
    }

    async function handleCancel(orderId: string) {
        if (!window.confirm("이 주문을 취소 처리하시겠습니까?")) return;

        try {
            setSavingId(orderId);

            const res = await fetch(`/api/seller/${tenant}/orders/${orderId}/status`, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "content-type": "application/json",
                    accept: "application/json",
                },
                body: JSON.stringify({ status: 9 }),
            });

            const json = await res.json().catch(() => null);

            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || "주문 취소에 실패했습니다.");
            }

            await load();
        } catch (e: any) {
            alert(e?.message || "주문 취소에 실패했습니다.");
        } finally {
            setSavingId(null);
        }
    }

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;

        return items.filter((item) => {
            const summary = getOrderSummary(item).toLowerCase();
            const category = getCategoryLabel(item).toLowerCase();
            const pickupDate = getPickupDate(item).toLowerCase();
            const badge = getGroupBadge(item).toLowerCase();

            return (
                item.orderNo.toLowerCase().includes(q) ||
                item.buyerName.toLowerCase().includes(q) ||
                getStatusLabel(item.status).toLowerCase().includes(q) ||
                summary.includes(q) ||
                category.includes(q) ||
                pickupDate.includes(q) ||
                badge.includes(q)
            );
        });
    }, [items, query]);

    const hasQuery = query.trim().length > 0;

    return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="mb-5">
                <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                    주문 관리
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                    최근 주문을 확인하고 확인 처리 후 픽업완료로 변경할 수 있습니다.
                </p>
                {hasQuery ? (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                        현재 검색어: {query}
                    </div>
                ) : null}
            </div>

            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="주문번호 / 주문자 / 주문내역 / 상태 검색"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
            </div>

            {loading ? (
                <div className="grid gap-3">
                    {Array.from({ length: 5 }).map((_, idx) => (
                        <div
                            key={idx}
                            className="h-28 animate-pulse rounded-2xl bg-slate-100"
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
                    {filtered.map((item) => {
                        const summary = getOrderSummary(item);
                        const category = getCategoryLabel(item);
                        const pickupDate = getPickupDate(item);
                        const groupBadge = getGroupBadge(item);
                        const isDone = Number(item.status) === 4;
                        const isCanceled = Number(item.status) === 9;
                        const isSaving = savingId === item.id;

                        return (
                            <div
                                key={item.id}
                                className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-[1px] hover:shadow-md"
                            >
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <Link
                                        href={getSellerHref(tenant, `/orders/${item.id}`)}
                                        className="min-w-0 flex-1"
                                    >
                                        <div className="truncate text-base font-bold tracking-[-0.02em] text-slate-900">
                                            주문번호 {item.orderNo}
                                        </div>

                                        <div className="mt-1 text-sm text-slate-500">
                                            주문자 {item.buyerName}
                                        </div>

                                        {groupBadge || category ? (
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                {groupBadge ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                                                        <Tag className="h-3 w-3" />
                                                        {groupBadge}
                                                    </span>
                                                ) : null}

                                                {category ? (
                                                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                                                        {category}
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : null}

                                        {summary ? (
                                            <div className="mt-2 flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                                <Package2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                                <span className="line-clamp-2">{summary}</span>
                                            </div>
                                        ) : null}

                                        {pickupDate ? (
                                            <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                                                <CalendarDays className="h-3.5 w-3.5" />
                                                픽업 예정일 {pickupDate}
                                            </div>
                                        ) : null}

                                        {(item.saleEndAtText || item.pickupStartAtText || item.pickupEndAtText) ? (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {item.saleEndAtText ? (
                                                    <span className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
                                                        <CalendarDays className="h-3.5 w-3.5" />
                                                        공구 마감 {item.saleEndAtText}
                                                    </span>
                                                ) : null}
                                                {(item.pickupStartAtText || item.pickupEndAtText) ? (
                                                    <span className="inline-flex items-center gap-1 rounded-xl bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                                                        <CalendarDays className="h-3.5 w-3.5" />
                                                        픽업 {item.pickupStartAtText && item.pickupEndAtText && item.pickupStartAtText !== item.pickupEndAtText
                                                            ? `${item.pickupStartAtText} ~ ${item.pickupEndAtText}`
                                                            : (item.pickupStartAtText || item.pickupEndAtText)}
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : null}

                                        <div className="mt-2 text-xs text-slate-400">
                                            {item.createdAtText}
                                        </div>
                                    </Link>

                                    <div className="flex flex-col items-end gap-3">
                                        <div className="flex items-center gap-3">
                                            <span
                                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(item.status)}`}
                                            >
                                                {getStatusLabel(item.status)}
                                            </span>
                                            <span className="text-sm font-bold text-slate-900">
                                                {(item.amount ?? 0).toLocaleString("ko-KR")}원
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <Link
                                                href={getSellerHref(tenant, `/orders/${item.id}`)}
                                                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                                            >
                                                상세보기
                                            </Link>

                                            <button
                                                type="button"
                                                onClick={() => handleConfirm(item.id)}
                                                disabled={isDone || isCanceled || isSaving}
                                                className="inline-flex min-w-[96px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                            >
                                                {isSaving ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="h-4 w-4" />
                                                )}
                                                {isDone ? "픽업완료" : isCanceled ? "취소주문" : "확인"}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleCancel(item.id)}
                                                disabled={isCanceled || isSaving || !(item.canCancel ?? !isCanceled)}
                                                className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                                            >
                                                {isCanceled ? "취소됨" : "취소"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}