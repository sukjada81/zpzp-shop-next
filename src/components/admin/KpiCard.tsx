// src/components/admin/KpiCard.tsx
export default function KpiCard({
                                    title,
                                    value,
                                    sub,
                                }: {
    title: string;
    value: string;
    sub?: string;
}) {
    return (
        <div className="rounded-2xl border bg-white p-3 shadow-sm">
            <div className="text-xs font-semibold text-slate-500">{title}</div>
            <div className="mt-1 text-lg font-extrabold text-slate-900 tabular-nums">
                {value}
            </div>
            {sub ? (
                <div className="mt-1 text-xs text-slate-500">{sub}</div>
            ) : null}
        </div>
    );
}