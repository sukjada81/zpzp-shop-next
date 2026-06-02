// src/components/seller/SellerTenantsListClient.tsx
"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

type TenantItem = {
    id: number;
    slug: string;
    name: string;
    status: string;
    primaryDomain: string | null;
    openchatUrl: string | null;
};

const STATUS_LABELS: Record<string, string> = {
    active: "운영중",
    inactive: "운영중지",
    draft: "준비중",
};

function StatusBadge({ status }: { status: string }) {
    const cls =
        status === "active"
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
            : status === "draft"
                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
    return (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
            {STATUS_LABELS[status] ?? status}
        </span>
    );
}

export default function SellerTenantsListClient({ items }: { items: TenantItem[] }) {
    return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                        지점 관리
                    </h1>
                </div>
                <Link
                    href="/__all__/tenants/new"
                    className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                >
                    <Plus className="h-4 w-4" />
                    신규 지점
                </Link>
            </div>

            {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                    등록된 지점이 없습니다.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                <th className="px-3 py-2">이름</th>
                                <th className="px-3 py-2">지점 코드</th>
                                <th className="px-3 py-2">상태</th>
                                <th className="px-3 py-2">도메인</th>
                                <th className="px-3 py-2 text-right">&nbsp;</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((t) => (
                                <tr
                                    key={t.id}
                                    className="border-b border-slate-100 hover:bg-slate-50"
                                >
                                    <td className="px-3 py-3 font-semibold text-slate-900">
                                        {t.name}
                                    </td>
                                    <td className="px-3 py-3 font-mono text-xs text-slate-600">
                                        {t.slug}
                                    </td>
                                    <td className="px-3 py-3">
                                        <StatusBadge status={t.status} />
                                    </td>
                                    <td className="px-3 py-3 text-slate-600">
                                        {t.primaryDomain ?? "-"}
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                        <Link
                                            href={`/__all__/tenants/${t.id}`}
                                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                        >
                                            수정
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
