// src/components/seller/SellerApplicationsClient.tsx
"use client";

import { useState } from "react";
import { CheckCircle, XCircle, RefreshCw } from "lucide-react";

export type ApplicationItem = {
    id: number;
    memberUid: number;
    memberName: string;
    memberPhone: string;
    memberEmail: string;
    roleCode: string;
    status: string;
    tenantId: number | null;
    tenantSlug: string;
    tenantName: string;
    joinedAt: string | null;
};

type StatusFilter = "pending" | "active" | "rejected" | "all";

function formatDate(iso: string | null) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("ko-KR", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
    });
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        pending: "bg-amber-100 text-amber-700",
        active: "bg-green-100 text-green-700",
        rejected: "bg-red-100 text-red-600",
    };
    const label: Record<string, string> = {
        pending: "승인 대기",
        active: "승인됨",
        rejected: "거절됨",
    };
    return (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
            {label[status] ?? status}
        </span>
    );
}

export default function SellerApplicationsClient({
    tenant,
    initialItems,
    initialStatus,
}: {
    tenant: string;
    initialItems: ApplicationItem[];
    initialStatus: StatusFilter;
}) {
    const [items, setItems] = useState<ApplicationItem[]>(initialItems);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

    async function loadItems(status: StatusFilter) {
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch(
                `/api/seller/${tenant}/applications?status=${status}`,
                { cache: "no-store", credentials: "include" }
            );
            const data = await res.json().catch(() => null);
            if (data?.ok && Array.isArray(data.items)) {
                setItems(data.items);
            }
        } finally {
            setLoading(false);
        }
    }

    async function handleStatusChange(next: StatusFilter) {
        setStatusFilter(next);
        await loadItems(next);
    }

    async function handleAction(id: number, action: "approve" | "reject") {
        setActionLoading(id);
        setMessage(null);
        try {
            const res = await fetch(
                `/api/seller/${tenant}/applications/${id}/${action}`,
                { method: "POST", credentials: "include" }
            );
            const data = await res.json().catch(() => null);
            if (data?.ok) {
                setMessage({ type: "ok", text: action === "approve" ? "승인되었습니다." : "거절되었습니다." });
                await loadItems(statusFilter);
            } else {
                setMessage({ type: "err", text: data?.message || "처리 중 오류가 발생했습니다." });
            }
        } catch {
            setMessage({ type: "err", text: "처리 중 오류가 발생했습니다." });
        } finally {
            setActionLoading(null);
        }
    }

    const FILTERS: { value: StatusFilter; label: string }[] = [
        { value: "pending", label: "승인 대기" },
        { value: "active", label: "승인됨" },
        { value: "rejected", label: "거절됨" },
        { value: "all", label: "전체" },
    ];

    return (
        <div className="space-y-4">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-900">셀러 승인 관리</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            셀러 권한을 신청한 회원 목록입니다.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => loadItems(statusFilter)}
                        disabled={loading}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        새로고침
                    </button>
                </div>

                <div className="mt-4 flex gap-2">
                    {FILTERS.map((f) => (
                        <button
                            key={f.value}
                            type="button"
                            onClick={() => handleStatusChange(f.value)}
                            className={[
                                "rounded-xl px-3 py-1.5 text-sm font-semibold transition",
                                statusFilter === f.value
                                    ? "bg-slate-900 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                            ].join(" ")}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {message ? (
                <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                    message.type === "ok"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-red-50 text-red-600 border border-red-200"
                }`}>
                    {message.text}
                </div>
            ) : null}

            <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center text-sm text-slate-400">불러오는 중...</div>
                ) : items.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-400">해당하는 신청 내역이 없습니다.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                                    <th className="px-5 py-3">회원명</th>
                                    <th className="px-5 py-3">연락처</th>
                                    <th className="px-5 py-3">지점</th>
                                    <th className="px-5 py-3">신청일</th>
                                    <th className="px-5 py-3">상태</th>
                                    <th className="px-5 py-3">처리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                        <td className="px-5 py-3.5 font-medium text-slate-900">
                                            {item.memberName}
                                            <div className="text-xs font-normal text-slate-400">{item.memberEmail || "-"}</div>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600">{item.memberPhone}</td>
                                        <td className="px-5 py-3.5">
                                            <span className="font-medium text-slate-800">{item.tenantName}</span>
                                            <span className="ml-1 text-xs text-slate-400">({item.tenantSlug})</span>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-500 text-xs">{formatDate(item.joinedAt)}</td>
                                        <td className="px-5 py-3.5">
                                            <StatusBadge status={item.status} />
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex gap-2">
                                                {item.status !== "active" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAction(item.id, "approve")}
                                                        disabled={actionLoading === item.id}
                                                        className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                                                    >
                                                        <CheckCircle className="h-3.5 w-3.5" />
                                                        승인
                                                    </button>
                                                )}
                                                {item.status !== "rejected" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAction(item.id, "reject")}
                                                        disabled={actionLoading === item.id}
                                                        className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50"
                                                    >
                                                        <XCircle className="h-3.5 w-3.5" />
                                                        거절
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
