// src/components/admin/RecentTable.tsx
import type { AdminRecentOrderRow } from "@/lib/admin/types";

function badgeClass(status: string) {
    switch (status) {
        case "PENDING":
            return "bg-amber-50 text-amber-700 border-amber-200";
        case "CONFIRMED":
            return "bg-blue-50 text-blue-700 border-blue-200";
        case "READY":
            return "bg-purple-50 text-purple-700 border-purple-200";
        case "DONE":
            return "bg-emerald-50 text-emerald-700 border-emerald-200";
        case "CANCELED":
            return "bg-rose-50 text-rose-700 border-rose-200";
        default:
            return "bg-slate-50 text-slate-700 border-slate-200";
    }
}

export default function RecentTable({
                                        title,
                                        rows,
                                        tenant,
                                    }: {
    title: string;
    rows: AdminRecentOrderRow[];
    tenant: string;
}) {
    return (
        <div className="rounded-2xl border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="text-sm font-bold text-slate-900">{title}</div>
                <a
                    href={`/admin/${tenant}/orders`}
                    className="text-xs font-semibold text-slate-700 hover:underline"
                >
                    전체 보기 →
                </a>
            </div>

            <div className="overflow-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-600">
                    <tr>
                        <th className="px-4 py-2 text-left font-semibold">주문번호</th>
                        <th className="px-4 py-2 text-left font-semibold">구매자</th>
                        <th className="px-4 py-2 text-right font-semibold">금액</th>
                        <th className="px-4 py-2 text-left font-semibold">상태</th>
                        <th className="px-4 py-2 text-left font-semibold">픽업</th>
                        <th className="px-4 py-2 text-right font-semibold">액션</th>
                    </tr>
                    </thead>
                    <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td
                                className="px-4 py-6 text-center text-slate-500"
                                colSpan={6}
                            >
                                최근 주문이 없습니다.
                            </td>
                        </tr>
                    ) : (
                        rows.map((r) => (
                            <tr key={r.orderNo} className="border-t">
                                <td className="px-4 py-3 font-mono text-[12px] text-slate-700">
                                    {r.orderNo}
                                </td>
                                <td className="px-4 py-3 text-slate-800">
                                    <div className="font-semibold">{r.buyerName}</div>
                                    <div className="text-xs text-slate-500">{r.buyerPhone}</div>
                                </td>
                                <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                                    {r.totalAmount.toLocaleString()}원
                                </td>
                                <td className="px-4 py-3">
                    <span
                        className={[
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold",
                            badgeClass(r.status),
                        ].join(" ")}
                    >
                      {r.status}
                    </span>
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                    {r.pickupAt ?? "-"}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <a
                                        href={`/admin/${tenant}/orders?orderNo=${encodeURIComponent(r.orderNo)}`}
                                        className="rounded-lg border px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                                    >
                                        보기
                                    </a>
                                </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}