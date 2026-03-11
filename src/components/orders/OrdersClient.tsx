// src/components/orders/OrdersClient.tsx
"use client";

export type OrderSummary = {
    orderNo: string;
    status: string;
    title: string;
    totalPrice: number;
    createdAt: string;
    pickupAt?: string | null;
    thumbnailUrl?: string;
    isNew?: boolean;
};

function statusTone(status: string) {
    if (status.includes("취소")) {
        return {
            bg: "bg-rose-50",
            bd: "border-rose-200",
            tx: "text-rose-700",
        };
    }

    if (status.includes("픽업완료")) {
        return {
            bg: "bg-[color:var(--brand-soft)]",
            bd: "border-[color:var(--border)]",
            tx: "text-[color:var(--brand)]",
        };
    }

    if (status.includes("픽업준비")) {
        return {
            bg: "bg-[color:var(--accent-soft)]",
            bd: "border-[color:var(--border)]",
            tx: "text-[color:var(--brand)]",
        };
    }

    return {
        bg: "bg-slate-50",
        bd: "border-slate-200",
        tx: "text-slate-700",
    };
}

function formatDateText(value: string) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
}

export default function OrdersClient(props: {
    tenant: string;
    initialOrders?: OrderSummary[];
    loading?: boolean;
}) {
    const { initialOrders, loading } = props;
    const orders = initialOrders ?? [];

    return (
        <section className="space-y-3">
            <div className="rounded-2xl border border-[color:var(--border)] bg-white p-4 shadow-sm">
                <div className="text-[18px] font-extrabold text-[color:var(--fg)]">주문내역</div>
                <div className="mt-1 text-[12px] font-semibold text-[color:var(--muted)]">
                    주문 상태/픽업 정보는 주문 상세에서 확인할 수 있어요.
                </div>
            </div>

            {loading ? (
                <div className="rounded-2xl border border-[color:var(--border)] bg-white p-6 text-center shadow-sm">
                    <div className="text-[14px] font-semibold text-[color:var(--muted)]">
                        주문내역을 불러오는 중입니다.
                    </div>
                </div>
            ) : orders.length === 0 ? (
                <div className="rounded-2xl border border-[color:var(--border)] bg-white p-6 text-center shadow-sm">
                    <div className="text-[15px] font-extrabold text-[color:var(--fg)]">주문내역이 없습니다</div>
                    <div className="mt-2 text-xs font-semibold text-[color:var(--muted)]">
                        주문을 완료하면 이곳에서 확인할 수 있어요.
                    </div>
                </div>
            ) : (
                orders.map((o) => {
                    const tone = statusTone(o.status);

                    return (
                        <a
                            key={o.orderNo}
                            href={`/${props.tenant}/orders/${encodeURIComponent(o.orderNo)}`}
                            className="block rounded-2xl border border-[color:var(--border)] bg-white p-4 shadow-sm transition hover:bg-[color:var(--accent-soft)]"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span
                                            className={[
                                                "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-extrabold",
                                                tone.bg,
                                                tone.bd,
                                                tone.tx,
                                            ].join(" ")}
                                        >
                                            {o.status}
                                        </span>

                                        {o.isNew ? (
                                            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-[11px] font-extrabold text-red-600">
                                                방금 주문
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="mt-3 line-clamp-2 text-[14px] font-extrabold text-[color:var(--fg)]">
                                        {o.title}
                                    </div>

                                    <div className="mt-2 text-[14px] font-extrabold text-[color:var(--fg)]">
                                        {o.totalPrice.toLocaleString()}원
                                    </div>

                                    {o.createdAt ? (
                                        <div className="mt-2 text-[12px] font-semibold text-[color:var(--muted)]">
                                            주문일시: {formatDateText(o.createdAt)}
                                        </div>
                                    ) : null}

                                    {o.pickupAt ? (
                                        <div className="mt-1 text-[12px] font-semibold text-[color:var(--muted)]">
                                            픽업 예정: {formatDateText(o.pickupAt)}
                                        </div>
                                    ) : null}

                                    <div className="mt-2 text-[11px] font-semibold text-[color:var(--muted)]">
                                        주문번호: {o.orderNo}
                                    </div>
                                </div>

                                <div className="shrink-0 text-sm font-extrabold text-[color:var(--muted)]/60">
                                    →
                                </div>
                            </div>
                        </a>
                    );
                })
            )}

            <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-white p-4 text-sm font-semibold text-[color:var(--fg)] shadow-sm">
                주문 후 <span className="font-extrabold text-[color:var(--brand)]">픽업 일정</span>과
                진행 상태를 확인할 수 있어요.
            </div>
        </section>
    );
}