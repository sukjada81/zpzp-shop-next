"use client";

import { useState } from "react";
import LinkerProductDetailModal from "./LinkerProductDetailModal";

export type LinkerStatsRow = {
    uid: number;
    shopSlug: string;
    shopName: string;
    status: string;
    registeredProductCount: number;
    activeProductCount: number;
};

export default function LinkerProductStatsTable({ rows }: { rows: LinkerStatsRow[] }) {
    const [modal, setModal] = useState<{ linkerUid: number; label: string } | null>(null);

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                    <thead>
                        <tr className="border-b border-[var(--dad-border)] text-xs font-extrabold text-[var(--dad-muted)]">
                            <th className="px-4 py-3">링커</th>
                            <th className="px-4 py-3">샵 URL</th>
                            <th className="px-4 py-3 text-center">등록 상품</th>
                            <th className="px-4 py-3 text-center">스토어 노출</th>
                            <th className="px-4 py-3 text-center">상태</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.uid} className="border-b border-[var(--dad-border)] hover:bg-slate-50">
                                <td className="px-4 py-3 font-bold text-[var(--dad-ink)]">{row.shopName || row.shopSlug}</td>
                                <td className="px-4 py-3 text-[var(--dad-muted)]">{row.shopSlug}.zpzp.kr</td>
                                <td className="px-4 py-3 text-center">
                                    <button
                                        type="button"
                                        onClick={() => setModal({ linkerUid: row.uid, label: row.shopName || row.shopSlug })}
                                        className="inline-flex min-w-10 items-center justify-center rounded-full bg-blue-50 px-3 py-1 text-sm font-extrabold text-blue-700 hover:bg-blue-100"
                                    >
                                        {row.registeredProductCount}
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <button
                                        type="button"
                                        onClick={() => setModal({ linkerUid: row.uid, label: row.shopName || row.shopSlug })}
                                        className="inline-flex min-w-10 items-center justify-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-extrabold text-emerald-700 hover:bg-emerald-100"
                                    >
                                        {row.activeProductCount}
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">
                                        {row.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-sm font-bold text-[var(--dad-muted)]">
                                    등록된 링커가 없습니다.
                                </td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
            </div>

            {modal ? (
                <LinkerProductDetailModal
                    kind="linker-products"
                    linkerUid={modal.linkerUid}
                    linkerLabel={modal.label}
                    onClose={() => setModal(null)}
                />
            ) : null}
        </>
    );
}
