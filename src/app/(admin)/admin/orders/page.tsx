// src/app/(admin)/admin/orders/page.tsx
import { headers } from "next/headers";
import OrderStatusSelect from "./ui/OrderStatusSelect";

type OrderRow = {
    id: string | number;
    orderNo: string;
    buyerName: string;
    buyerPhone: string;
    status: string;
    paymentStatus: string;
    totalAmount: number | string;
    pickupAt: string | null;
    createdAt: string;
    tenant: { slug: string; name: string };
};

type OrdersRes = {
    ok: boolean;
    total: number;
    page: number;
    limit: number;
    rows: OrderRow[];
    message?: string;
};

async function getOrigin() {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
}

async function fetchOrders(qs: URLSearchParams): Promise<OrdersRes> {
    const origin = await getOrigin();
    const res = await fetch(`${origin}/api/admin/orders?${qs.toString()}`, { cache: "no-store" });
    return res.json();
}

const STATUS = ["", "PENDING", "CONFIRMED", "READY", "DONE", "CANCELED"];

function chipClass(active: boolean) {
    return [
        "rounded-full border px-3 py-2 text-xs font-extrabold",
        active
            ? "border-transparent bg-[var(--dad-ink)] text-white"
            : "border-[var(--dad-border)] bg-white/70 text-[var(--dad-ink)] hover:bg-[var(--dad-cream)]",
    ].join(" ");
}

export default async function AdminOrdersPage({
                                                  searchParams,
                                              }: {
    searchParams: { tenant?: string; status?: string; q?: string; page?: string };
}) {
    const qs = new URLSearchParams();
    qs.set("tenant", searchParams.tenant || "all");
    if (searchParams.status) qs.set("status", searchParams.status);
    if (searchParams.q) qs.set("q", searchParams.q);
    qs.set("page", searchParams.page || "1");
    qs.set("limit", "20");

    const data = await fetchOrders(qs);

    const tenant = qs.get("tenant") || "all";
    const status = qs.get("status") || "";
    const q = qs.get("q") || "";
    const page = Number(qs.get("page") || 1);
    const totalPages = Math.max(1, Math.ceil((data.total || 0) / (data.limit || 20)));

    return (
        <div className="space-y-4">
            <div className="dad-card p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="text-lg font-extrabold text-[var(--dad-ink)]">주문 관리</div>
                        <div className="text-sm font-bold text-[var(--dad-muted)]">
                            통합 관리자 / 전체 tenant 주문을 조회/처리합니다.
                        </div>
                    </div>
                    <a href="/dashboard" className="dad-btn dad-btn-ghost px-4 py-2 text-sm">
                        대시보드 →
                    </a>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    {["all", "a", "b"].map((t) => (
                        <a
                            key={t}
                            className={chipClass(tenant === t)}
                            href={`/orders?tenant=${encodeURIComponent(t)}&status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}&page=1`}
                        >
                            {t === "all" ? "전체" : `${t.toUpperCase()} 지점`}
                        </a>
                    ))}
                </div>

                <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
                    <form className="flex w-full gap-2" action="/orders" method="get">
                        <input type="hidden" name="tenant" value={tenant} />
                        <select
                            name="status"
                            defaultValue={status}
                            className="h-11 w-[170px] rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)]"
                        >
                            {STATUS.map((s) => (
                                <option key={s || "ALL"} value={s}>
                                    {s ? s : "상태(전체)"}
                                </option>
                            ))}
                        </select>

                        <input
                            name="q"
                            defaultValue={q}
                            placeholder="주문번호/구매자/전화 검색"
                            className="h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                        />
                        <button className="h-11 shrink-0 rounded-2xl bg-[var(--dad-ink)] px-5 text-sm font-extrabold text-white">
                            검색
                        </button>
                    </form>

                    <div className="text-xs font-bold text-[var(--dad-muted)]">
                        Page {page} / {totalPages} · Total {data.total || 0}
                    </div>
                </div>
            </div>

            <div className="dad-card p-5">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] text-left text-sm">
                        <thead>
                        <tr className="border-b border-[var(--dad-border)] text-xs font-extrabold text-[var(--dad-muted)]">
                            <th className="py-3 pr-3">지점</th>
                            <th className="py-3 pr-3">주문번호</th>
                            <th className="py-3 pr-3">구매자</th>
                            <th className="py-3 pr-3">상태</th>
                            <th className="py-3 pr-3">결제</th>
                            <th className="py-3 pr-3 text-right">금액</th>
                            <th className="py-3 pr-3">픽업</th>
                            <th className="py-3 pr-3">일시</th>
                        </tr>
                        </thead>
                        <tbody>
                        {(data.rows || []).map((o) => (
                            <tr key={String(o.id)} className="border-b border-[var(--dad-border)]">
                                <td className="py-3 pr-3 font-bold text-[var(--dad-ink)]">
                                    {o.tenant?.name} ({o.tenant?.slug})
                                </td>
                                <td className="py-3 pr-3 font-extrabold text-[var(--dad-ink)]">{o.orderNo}</td>
                                <td className="py-3 pr-3">
                                    <div className="font-bold text-[var(--dad-ink)]">{o.buyerName}</div>
                                    <div className="text-xs font-bold text-[var(--dad-muted)]">{o.buyerPhone}</div>
                                </td>
                                <td className="py-3 pr-3">
                                    <OrderStatusSelect id={String(o.id)} current={o.status} />
                                </td>
                                <td className="py-3 pr-3">
                    <span className="inline-flex items-center rounded-full border border-[var(--dad-border)] bg-white/70 px-3 py-1 text-xs font-extrabold text-[var(--dad-ink)]">
                      {o.paymentStatus}
                    </span>
                                </td>
                                <td className="py-3 pr-3 text-right font-extrabold text-[var(--dad-ink)]">
                                    {Number(o.totalAmount ?? 0).toLocaleString()}원
                                </td>
                                <td className="py-3 pr-3 text-xs font-bold text-[var(--dad-muted)]">
                                    {o.pickupAt ? new Date(o.pickupAt).toLocaleString("ko-KR") : "-"}
                                </td>
                                <td className="py-3 pr-3 text-xs font-bold text-[var(--dad-muted)]">
                                    {new Date(o.createdAt).toLocaleString("ko-KR")}
                                </td>
                            </tr>
                        ))}

                        {(data.rows || []).length === 0 && (
                            <tr>
                                <td colSpan={8} className="py-10 text-center text-sm font-bold text-[var(--dad-muted)]">
                                    주문 데이터가 없습니다.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <a
                        className="dad-btn dad-btn-ghost px-4 py-2 text-sm"
                        href={`/orders?tenant=${encodeURIComponent(tenant)}&status=${encodeURIComponent(status)}&q=${encodeURIComponent(
                            q
                        )}&page=${Math.max(1, page - 1)}`}
                    >
                        ← 이전
                    </a>
                    <a
                        className="dad-btn dad-btn-ghost px-4 py-2 text-sm"
                        href={`/orders?tenant=${encodeURIComponent(tenant)}&status=${encodeURIComponent(status)}&q=${encodeURIComponent(
                            q
                        )}&page=${Math.min(totalPages, page + 1)}`}
                    >
                        다음 →
                    </a>
                </div>
            </div>
        </div>
    );
}