// src/components/seller/SellerOrderDetailClient.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { getSellerHref } from "@/lib/seller/getSellerHref";

type OrderItem = {
    id: string;
    orderNo: string;
    buyerName: string;
    amount: number;
    status: string;
    createdAtText: string;
    phone?: string;
    memo?: string;
    address?: string;
};

const STATUS_OPTIONS = [
    { value: "pending", label: "주문접수" },
    { value: "preparing", label: "준비중" },
    { value: "completed", label: "주문완료" },
    { value: "canceled", label: "주문취소" },
];

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

export default function SellerOrderDetailClient({
                                                    tenant,
                                                    id,
                                                }: {
    tenant: string;
    id: string;
}) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [loaded, setLoaded] = useState<OrderItem | null>(null);
    const [status, setStatus] = useState("pending");

    async function load() {
        try {
            setError("");
            const res = await fetch(`/api/seller/${tenant}/orders/${id}`, {
                cache: "no-store",
            });
            const json = await res.json();

            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || "주문 정보를 불러오지 못했습니다.");
            }

            const item = json.item as OrderItem;
            setLoaded(item);
            setStatus(item.status || "pending");
        } catch (e: any) {
            setError(e?.message || "주문 정보를 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenant, id]);

    async function updateStatus() {
        try {
            setSaving(true);
            setError("");

            const res = await fetch(`/api/seller/${tenant}/orders/${id}/status`, {
                method: "PATCH",
                headers: {
                    "content-type": "application/json",
                    accept: "application/json",
                },
                body: JSON.stringify({ status }),
            });

            const json = await res.json().catch(() => ({}));

            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || "상태 변경에 실패했습니다.");
            }

            alert("주문 상태가 변경되었습니다.");
            await load();
        } catch (e: any) {
            setError(e?.message || "상태 변경에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="space-y-4 animate-pulse">
                    <div className="h-8 w-40 rounded-xl bg-slate-100" />
                    <div className="h-40 rounded-3xl bg-slate-100" />
                </div>
            </div>
        );
    }

    if (error && !loaded) {
        return (
            <div className="rounded-[28px] border border-rose-200 bg-white p-5 text-rose-700 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="text-base font-bold">주문 정보를 불러오지 못했습니다.</div>
                <div className="mt-2 text-sm">{error}</div>
                <Link
                    href={getSellerHref(tenant, "/orders")}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                    <ArrowLeft className="h-4 w-4" />
                    목록으로
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Seller Order
                    </div>
                    <div className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                        주문 상세
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                        주문 상태를 확인하고 변경할 수 있습니다.
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href={getSellerHref(tenant, "/orders")}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        목록
                    </Link>
                    <button
                        type="button"
                        onClick={updateStatus}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                        <RefreshCw className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} />
                        {saving ? "변경 중..." : "상태 저장"}
                    </button>
                </div>
            </div>

            {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    {error}
                </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <div className="text-sm font-semibold text-slate-500">주문번호</div>
                            <div className="mt-2 text-xl font-bold tracking-[-0.03em] text-slate-900">
                                {loaded?.orderNo}
                            </div>
                        </div>

                        <div>
                            <div className="text-sm font-semibold text-slate-500">주문상태</div>
                            <div className="mt-2">
                                <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${statusBadge(loaded?.status || "")}`}>
                                    {loaded?.status}
                                </span>
                            </div>
                        </div>

                        <div>
                            <div className="text-sm font-semibold text-slate-500">주문자</div>
                            <div className="mt-2 text-base font-semibold text-slate-900">
                                {loaded?.buyerName || "-"}
                            </div>
                        </div>

                        <div>
                            <div className="text-sm font-semibold text-slate-500">주문금액</div>
                            <div className="mt-2 text-base font-semibold text-slate-900">
                                {(loaded?.amount ?? 0).toLocaleString("ko-KR")}원
                            </div>
                        </div>

                        <div>
                            <div className="text-sm font-semibold text-slate-500">연락처</div>
                            <div className="mt-2 text-base font-semibold text-slate-900">
                                {loaded?.phone || "-"}
                            </div>
                        </div>

                        <div>
                            <div className="text-sm font-semibold text-slate-500">주문일시</div>
                            <div className="mt-2 text-base font-semibold text-slate-900">
                                {loaded?.createdAtText || "-"}
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <div className="text-sm font-semibold text-slate-500">주소</div>
                            <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                {loaded?.address || "-"}
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <div className="text-sm font-semibold text-slate-500">메모</div>
                            <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                {loaded?.memo || "-"}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                    <div className="text-lg font-bold tracking-[-0.03em] text-slate-900">
                        주문 상태 변경
                    </div>

                    <div className="mt-4">
                        <label className="text-sm font-semibold text-slate-700">변경 상태</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none"
                        >
                            {STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                        실무에서는 주문접수 → 준비중 → 주문완료 순서로 주로 처리합니다.
                        취소 주문은 canceled 로 변경합니다.
                    </div>
                </section>
            </div>
        </div>
    );
}