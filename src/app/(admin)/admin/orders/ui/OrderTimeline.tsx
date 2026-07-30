// src/app/(admin)/admin/orders/ui/OrderTimeline.tsx
type TimelineEntry = {
    id: string;
    source: string;
    eventType: string;
    label: string;
    detail: string | null;
    orderGoodsUid: number | null;
    actor: string | null;
    amount: number | null;
    at: string;
};

function formatWhen(value: string) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString("ko-KR");
}

function sourceBadge(source: string) {
    switch (source) {
        case "toss_cancel":
            return "PG";
        case "toss_prepare":
            return "결제";
        case "audit":
            return "감사";
        default:
            return "상태";
    }
}

export default function OrderTimeline(props: { entries: TimelineEntry[] }) {
    const { entries } = props;

    if (!entries.length) {
        return (
            <div className="rounded-2xl border border-dashed border-[var(--dad-border)] bg-white/50 p-6 text-sm font-semibold text-[var(--dad-muted)]">
                아직 기록된 결제·취소·상태 이력이 없습니다.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {entries.map((entry) => (
                <article
                    key={entry.id}
                    className="rounded-2xl border border-[var(--dad-border)] bg-white/80 p-4"
                >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold text-slate-600">
                                    {sourceBadge(entry.source)}
                                </span>
                                <span className="text-sm font-extrabold text-[var(--dad-ink)]">
                                    {entry.label}
                                </span>
                                {entry.orderGoodsUid ? (
                                    <span className="text-[11px] font-bold text-[var(--dad-muted)]">
                                        상품 #{entry.orderGoodsUid}
                                    </span>
                                ) : null}
                            </div>
                            {entry.detail ? (
                                <div className="mt-2 text-sm font-semibold text-[var(--dad-muted)]">
                                    {entry.detail}
                                </div>
                            ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                            <div className="text-[11px] font-bold text-[var(--dad-muted)]">
                                {formatWhen(entry.at)}
                            </div>
                            {entry.amount != null && entry.amount > 0 ? (
                                <div className="mt-1 text-sm font-extrabold text-[var(--dad-ink)]">
                                    {entry.amount.toLocaleString()}원
                                </div>
                            ) : null}
                        </div>
                    </div>
                    {entry.actor ? (
                        <div className="mt-2 text-[11px] font-bold text-slate-500">
                            처리: {entry.actor}
                        </div>
                    ) : null}
                </article>
            ))}
        </div>
    );
}
