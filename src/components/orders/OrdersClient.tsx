// src/components/orders/OrdersClient.tsx
"use client";

export type OrderSummary = {
    orderNo: string;
    status: "주문완료" | "결제완료" | "픽업대기" | "픽업완료" | "취소";
    title: string;
    totalPrice: number;
    createdAt: string; // "2026-02-21 12:34"
};

function statusTone(status: OrderSummary["status"]) {
    // ✅ 브랜드 톤에 맞춘 라벨 (brand/accent-soft 중심)
    switch (status) {
        case "취소":
            return {
                bg: "bg-rose-50",
                bd: "border-rose-200",
                tx: "text-rose-700",
            };
        case "픽업완료":
            return {
                bg: "bg-[color:var(--brand-soft)]",
                bd: "border-[color:var(--border)]",
                tx: "text-[color:var(--brand)]",
            };
        case "픽업대기":
            return {
                bg: "bg-[color:var(--accent-soft)]",
                bd: "border-[color:var(--border)]",
                tx: "text-[color:var(--brand)]",
            };
        default:
            return {
                bg: "bg-slate-50",
                bd: "border-slate-200",
                tx: "text-slate-700",
            };
    }
}

export default function OrdersClient(props: {
    tenant: string;
    initialOrders?: OrderSummary[];
}) {
    const { initialOrders } = props;
    const orders = initialOrders ?? [];

    return (
        <section className="space-y-3">
            {/* ✅ 페이지 타이틀(내부 헤더)도 공통 헤더와 충돌하지 않게 카드형으로 */}
            <div className="rounded-2xl border border-[color:var(--border)] bg-white p-4 shadow-sm">
                <div className="text-[18px] font-extrabold text-[color:var(--fg)]">주문내역</div>
                <div className="mt-1 text-[12px] font-semibold text-[color:var(--muted)]">
                    주문 상태/금액은 주문 상세에서 확인할 수 있어요.
                </div>
            </div>

            {orders.length === 0 ? (
                <div className="rounded-2xl border border-[color:var(--border)] bg-white p-6 text-center shadow-sm">
                    <div className="text-[15px] font-extrabold text-[color:var(--fg)]">주문내역이 없습니다</div>
                    <div className="mt-2 text-xs font-semibold text-[color:var(--muted)]">
                        주문을 완료하면 이곳에서 확인할 수 있어요.
                    </div>

                    {/* ✅ 요청: 상품보기 버튼 불필요 → 제거 */}
                </div>
            ) : (
                orders.map((o) => {
                    const tone = statusTone(o.status);
                    return (
                        <a
                            key={o.orderNo}
                            href={`/${props.tenant}/orders/${o.orderNo}`}
                            className="block rounded-2xl border border-[color:var(--border)] bg-white p-4 shadow-sm transition hover:bg-[color:var(--accent-soft)]"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
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

                                        <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                      {o.createdAt}
                    </span>
                                    </div>

                                    <div className="mt-2 line-clamp-2 text-[13px] font-extrabold text-[color:var(--fg)]">
                                        {o.title}
                                    </div>

                                    <div className="mt-2 text-[14px] font-extrabold text-[color:var(--fg)]">
                                        {o.totalPrice.toLocaleString()}원
                                    </div>
                                </div>

                                <div className="shrink-0 text-sm font-extrabold text-[color:var(--muted)]/60">→</div>
                            </div>
                        </a>
                    );
                })
            )}

            {/* 하단 안내(톤 맞춤) */}
            <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-white p-4 text-sm font-semibold text-[color:var(--fg)] shadow-sm">
                주문 후 <span className="font-extrabold text-[color:var(--brand)]">픽업 일정</span>은 상품 상세/주문 상세에서
                확인할 수 있어요.
            </div>
        </section>
    );
}