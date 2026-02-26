// src/components/admin/products/ProductTable.tsx
"use client";

import Link from "next/link";

type Row = {
    id: string | number;
    title?: string;
    status?: string;
    basePrice?: number | string;
    pickupOnly?: boolean;
    minQty?: number | null;
    maxQty?: number | null;
    thumbnailUrl?: string | null;
    updatedAt?: string | Date;
    tenant?: { slug?: string; name?: string };
};

function fmtPrice(v: unknown) {
    const n = typeof v === "string" ? Number(v) : (v as number);
    if (!Number.isFinite(n)) return "-";
    return `${n.toLocaleString()}원`;
}

export default function ProductTable({ rows }: { rows: Row[] }) {
    return (
        <div className="overflow-auto">
            <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                    <th className="px-4 py-3 text-left font-semibold">지점</th>
                    <th className="px-4 py-3 text-left font-semibold">상품명</th>
                    <th className="px-4 py-3 text-left font-semibold">상태</th>
                    <th className="px-4 py-3 text-right font-semibold">가격</th>
                    <th className="px-4 py-3 text-right font-semibold">수량</th>
                    <th className="px-4 py-3 text-right font-semibold">액션</th>
                </tr>
                </thead>

                <tbody>
                {rows?.length ? (
                    rows.map((r) => {
                        const tenantLabel =
                            r.tenant?.name || r.tenant?.slug || "-";
                        const qty =
                            r.minQty || r.maxQty
                                ? `${r.minQty ?? "-"} ~ ${r.maxQty ?? "-"}`
                                : "-";

                        return (
                            <tr key={String(r.id)} className="border-t">
                                <td className="px-4 py-3 text-slate-700">{tenantLabel}</td>

                                <td className="px-4 py-3">
                                    <div className="font-extrabold text-slate-900">
                                        {r.title ?? "-"}
                                    </div>
                                    {r.pickupOnly ? (
                                        <div className="mt-0.5 text-xs text-slate-500">
                                            픽업전용
                                        </div>
                                    ) : (
                                        <div className="mt-0.5 text-xs text-slate-500">
                                            배송가능
                                        </div>
                                    )}
                                </td>

                                <td className="px-4 py-3">
                    <span className="inline-flex rounded-full border px-2 py-0.5 text-xs font-bold text-slate-700">
                      {r.status ?? "-"}
                    </span>
                                </td>

                                <td className="px-4 py-3 text-right font-extrabold tabular-nums text-slate-900">
                                    {fmtPrice(r.basePrice)}
                                </td>

                                <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                                    {qty}
                                </td>

                                <td className="px-4 py-3 text-right">
                                    <Link
                                        href={`/admin/products/${encodeURIComponent(String(r.id))}`}
                                        className="dad-btn dad-btn-ghost h-9 px-3 text-sm"
                                    >
                                        수정
                                    </Link>
                                </td>
                            </tr>
                        );
                    })
                ) : (
                    <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                            상품이 없습니다.
                        </td>
                    </tr>
                )}
                </tbody>
            </table>
        </div>
    );
}