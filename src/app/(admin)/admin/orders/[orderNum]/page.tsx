// src/app/(admin)/admin/orders/[orderNum]/page.tsx
import { headers } from "next/headers";
import Link from "next/link";
import OrderStatusSelect from "../ui/OrderStatusSelect";

type OrderItem = {
    id: string;
    productId: string;
    title: string;
    goodsCode: string;
    price: number;
    origPrice: number;
    qty: number;
    optionId: number;
    optionName: string;
    status: number;
    status2: number;
    vendor: string;
    tenantId: string;
    createdAt: string | null;
};

type OrderDetail = {
    id: string;
    orderNo: string;
    orderNum: string;
    tenantId: string;
    tenantSlug: string | null;
    tenantName: string | null;
    buyerId: string;
    buyerName: string;
    buyerPhone: string;
    receiverName: string;
    receiverPhone: string;
    message: string;
    memo: string;
    payTotal: number;
    cancelTotal: number;
    refundTotal: number;
    deliveryTotal: number;
    payType: string;
    payStatus: string;
    payStatusLabel: string;
    payInfo: string;
    pickupAt: string | null;
    createdAt: string | null;
    statusDate: string | null;
    status: number;
    statusLabel: string;
    items: OrderItem[];
};

type DetailRes = {
    ok: boolean;
    order?: OrderDetail;
    message?: string;
};

async function getOrigin() {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
}

async function fetchOrder(orderNum: string): Promise<DetailRes> {
    const origin = await getOrigin();
    const h = await headers();
    const cookie = h.get("cookie") ?? "";

    const res = await fetch(`${origin}/api/admin/orders/${encodeURIComponent(orderNum)}`, {
        cache: "no-store",
        headers: { cookie },
    });

    return res.json();
}

function formatDateText(value?: string | null) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString("ko-KR");
}

export default async function AdminOrderDetailPage({
                                                       params,
                                                   }: {
    params: { orderNum: string } | Promise<{ orderNum: string }>;
}) {
    const resolved = await Promise.resolve(params);
    const orderNum = String(resolved?.orderNum ?? "").trim();

    if (!orderNum) {
        return <div className="p-6">주문번호가 없습니다.</div>;
    }

    const data = await fetchOrder(orderNum);

    if (!data?.ok || !data.order) {
        return <div className="p-6">주문 정보를 찾을 수 없습니다.</div>;
    }

    const order = data.order;

    return (
        <main className="mx-auto w-full max-w-[1200px] px-3 pb-10 pt-6 sm:px-4">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <div className="text-xl font-extrabold text-[var(--dad-ink)]">주문 상세</div>
                    <div className="mt-1 text-sm text-[var(--dad-muted)]">
                        주문번호: {order.orderNo}
                    </div>
                </div>

                <Link
                    href="/admin/orders"
                    className="dad-btn dad-btn-ghost h-10 px-4 text-sm"
                >
                    ← 주문 목록
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <section className="dad-card p-5 lg:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="text-base font-extrabold text-[var(--dad-ink)]">주문 정보</div>
                        <OrderStatusSelect orderNum={order.orderNum} current={String(order.status)} />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <InfoRow label="지점" value={`${order.tenantName || "-"}${order.tenantSlug ? ` (${order.tenantSlug})` : ""}`} />
                        <InfoRow label="주문상태" value={order.statusLabel} />
                        <InfoRow label="결제상태" value={order.payStatusLabel} />
                        <InfoRow label="결제방식" value={order.payType || "-"} />
                        <InfoRow label="주문일시" value={formatDateText(order.createdAt)} />
                        <InfoRow label="상태변경일시" value={formatDateText(order.statusDate)} />
                        <InfoRow label="픽업예정일시" value={formatDateText(order.pickupAt)} />
                        <InfoRow label="총 결제금액" value={`${Number(order.payTotal ?? 0).toLocaleString()}원`} />
                    </div>

                    {order.message ? (
                        <div className="mt-4 rounded-2xl border border-[var(--dad-border)] bg-white/70 p-4">
                            <div className="text-xs font-extrabold text-[var(--dad-muted)]">요청사항</div>
                            <div className="mt-2 text-sm font-bold text-[var(--dad-ink)] whitespace-pre-wrap">
                                {order.message}
                            </div>
                        </div>
                    ) : null}

                    {order.memo ? (
                        <div className="mt-4 rounded-2xl border border-[var(--dad-border)] bg-white/70 p-4">
                            <div className="text-xs font-extrabold text-[var(--dad-muted)]">메모</div>
                            <div className="mt-2 text-sm font-bold text-[var(--dad-ink)] whitespace-pre-wrap">
                                {order.memo}
                            </div>
                        </div>
                    ) : null}
                </section>

                <section className="dad-card p-5">
                    <div className="text-base font-extrabold text-[var(--dad-ink)]">주문자 / 수령인</div>

                    <div className="mt-4 space-y-4">
                        <div className="rounded-2xl border border-[var(--dad-border)] bg-white/70 p-4">
                            <div className="text-xs font-extrabold text-[var(--dad-muted)]">주문자</div>
                            <div className="mt-2 text-sm font-bold text-[var(--dad-ink)]">{order.buyerName}</div>
                            <div className="mt-1 text-sm font-bold text-[var(--dad-muted)]">{order.buyerPhone}</div>
                            <div className="mt-1 text-xs font-bold text-[var(--dad-muted)]">아이디: {order.buyerId || "-"}</div>
                        </div>

                        <div className="rounded-2xl border border-[var(--dad-border)] bg-white/70 p-4">
                            <div className="text-xs font-extrabold text-[var(--dad-muted)]">수령인</div>
                            <div className="mt-2 text-sm font-bold text-[var(--dad-ink)]">{order.receiverName}</div>
                            <div className="mt-1 text-sm font-bold text-[var(--dad-muted)]">{order.receiverPhone}</div>
                        </div>
                    </div>
                </section>
            </div>

            <section className="dad-card mt-4 p-5">
                <div className="mb-4 text-base font-extrabold text-[var(--dad-ink)]">주문 상품</div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-sm">
                        <thead>
                        <tr className="border-b border-[var(--dad-border)] text-xs font-extrabold text-[var(--dad-muted)]">
                            <th className="py-3 pr-3">상품명</th>
                            <th className="py-3 pr-3">상품코드</th>
                            <th className="py-3 pr-3">옵션</th>
                            <th className="py-3 pr-3 text-right">판매가</th>
                            <th className="py-3 pr-3 text-right">공급가</th>
                            <th className="py-3 pr-3 text-right">수량</th>
                            <th className="py-3 pr-3 text-right">합계</th>
                            <th className="py-3 pr-3">상태</th>
                        </tr>
                        </thead>
                        <tbody>
                        {order.items.map((item) => (
                            <tr key={item.id} className="border-b border-[var(--dad-border)]">
                                <td className="py-3 pr-3 font-bold text-[var(--dad-ink)]">{item.title}</td>
                                <td className="py-3 pr-3 font-bold text-[var(--dad-muted)]">{item.goodsCode || "-"}</td>
                                <td className="py-3 pr-3 font-bold text-[var(--dad-muted)]">{item.optionName || "-"}</td>
                                <td className="py-3 pr-3 text-right font-bold text-[var(--dad-ink)]">
                                    {Number(item.price ?? 0).toLocaleString()}원
                                </td>
                                <td className="py-3 pr-3 text-right font-bold text-[var(--dad-muted)]">
                                    {Number(item.origPrice ?? 0).toLocaleString()}원
                                </td>
                                <td className="py-3 pr-3 text-right font-bold text-[var(--dad-ink)]">
                                    {Number(item.qty ?? 0)}
                                </td>
                                <td className="py-3 pr-3 text-right font-extrabold text-[var(--dad-ink)]">
                                    {(Number(item.price ?? 0) * Number(item.qty ?? 0)).toLocaleString()}원
                                </td>
                                <td className="py-3 pr-3 font-bold text-[var(--dad-muted)]">
                                    {item.status}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-[var(--dad-border)] bg-white/70 p-4">
            <div className="text-xs font-extrabold text-[var(--dad-muted)]">{label}</div>
            <div className="mt-2 text-sm font-bold text-[var(--dad-ink)]">{value}</div>
        </div>
    );
}