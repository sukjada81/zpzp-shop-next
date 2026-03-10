// src/app/(admin)/admin/orders/page.tsx
import { headers } from "next/headers";
import Link from "next/link";
import OrderStatusSelect from "./ui/OrderStatusSelect";

type OrderRow = {
    id: string;
    orderNo: string;
    orderNum: string;
    tenantId: string;
    tenantSlug: string | null;
    tenantName: string | null;
    buyerName: string;
    buyerPhone: string;
    receiverName: string;
    receiverPhone: string;
    payTotal: number;
    payStatus: string;
    payStatusLabel: string;
    pickupAt: string | null;
    createdAt: string | null;
    status: number;
    statusLabel: string;
    itemCount: number;
};

type OrdersRes = {
    ok: boolean;
    total: number;
    page: number;
    limit: number;
    rows: OrderRow[];
    message?: string;
};

type SP = Record<string, string | string[] | undefined>;

async function getOrigin() {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
}

async function fetchOrders(qs: URLSearchParams): Promise<OrdersRes> {
    const origin = await getOrigin();
    const h = await headers();
    const cookie = h.get("cookie") ?? "";

    const res = await fetch(`${origin}/api/admin/orders?${qs.toString()}`, {
        cache: "no-store",
        headers: { cookie },
    });

    return res.json();
}

async function resolveSearchParams(searchParams: unknown): Promise<SP> {
    return ((await Promise.resolve(searchParams)) as SP | undefined) ?? {};
}

const STATUS_OPTIONS = [
    { value: "", label: "상태(전체)" },
    { value: "0", label: "주문접수" },
    { value: "1", label: "현장결제완료" },
    { value: "2", label: "픽업준비완료" },
    { value: "4", label: "픽업완료" },
    { value: "9", label: "주문취소" },
];

function chipClass(active: boolean) {
    return [
        "rounded-full border px-3 py-2 text-xs font-extrabold",
        active
            ? "border-transparent bg-[var(--dad-ink)] text-white"
            : "border-[var(--dad-border)] bg-white/70 text-[var(--dad-ink)] hover:bg-[var(--dad-cream)]",
    ].join(" ");
}

function formatDateText(value?: string | null) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString("ko-KR");
}

export default async function AdminOrdersPage({
                                                  searchParams,
                                              }: {
    searchParams?: Promise<SP> | SP;
}) {
    const sp = await resolveSearchParams(searchParams);

    const tenant = typeof sp.tenant === "string" ? sp.tenant : "all";
    const status = typeof sp.status === "string" ? sp.status : "";
    const q = typeof sp.q === "string" ? sp.q : "";
    const page = typeof sp.page === "string" ? sp.page : "1";

    const qs = new URLSearchParams();
    qs.set("tenant", tenant);
    if (status) qs.set("status", status);
    if (q) qs.set("q", q);
    qs.set("page", page);
    qs.set("limit", "20");

    const data = await fetchOrders(qs);

    const currentPage = Number(data.page || 1);
    const totalPages = Math.max(1, Math.ceil((data.total || 0) / (data.limit || 20)));

    return (
        <main className="mx-auto w-full max-w-[1600px] px-3 pb-10 pt-6 sm:px-4">
            <div className="space-y-4">
                <div className="dad-card p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="text-lg font-extrabold text-[var(--dad-ink)]">주문 관리</div>
                            <div className="text-sm font-bold text-[var(--dad-muted)]">
                                통합 관리자 / 전체 tenant 주문을 조회/처리합니다.
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        {[
                            { value: "all", label: "전체" },
                            { value: "hq", label: "본사 상품" },
                            { value: "a", label: "A 지점" },
                        ].map((t) => (
                            <a
                                key={t.value}
                                className={chipClass(tenant === t.value)}
                                href={`/admin/orders?tenant=${encodeURIComponent(t.value)}&status=${encodeURIComponent(
                                    status
                                )}&q=${encodeURIComponent(q)}&page=1`}
                            >
                                {t.label}
                            </a>
                        ))}
                    </div>

                    <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
                        <form className="flex w-full gap-2" action="/admin/orders" method="get">
                            <input type="hidden" name="tenant" value={tenant} />
                            <select
                                name="status"
                                defaultValue={status}
                                className="h-11 w-[170px] rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)]"
                            >
                                {STATUS_OPTIONS.map((s) => (
                                    <option key={s.value || "ALL"} value={s.value}>
                                        {s.label}
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
                            Page {currentPage} / {totalPages} · Total {data.total || 0}
                        </div>
                    </div>
                </div>

                <div className="dad-card p-5">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1180px] text-left text-sm">
                            <thead>
                            <tr className="border-b border-[var(--dad-border)] text-xs font-extrabold text-[var(--dad-muted)]">
                                <th className="py-3 pr-3">지점</th>
                                <th className="py-3 pr-3">주문번호</th>
                                <th className="py-3 pr-3">구매자</th>
                                <th className="py-3 pr-3">수령인</th>
                                <th className="py-3 pr-3">상품수</th>
                                <th className="py-3 pr-3">상태</th>
                                <th className="py-3 pr-3">결제상태</th>
                                <th className="py-3 pr-3 text-right">금액</th>
                                <th className="py-3 pr-3">픽업</th>
                                <th className="py-3 pr-3">주문일시</th>
                            </tr>
                            </thead>
                            <tbody>
                            {(data.rows || []).map((o) => (
                                <tr key={String(o.id)} className="border-b border-[var(--dad-border)]">
                                    <td className="py-3 pr-3 font-bold text-[var(--dad-ink)]">
                                        {o.tenantName || "-"} {o.tenantSlug ? `(${o.tenantSlug})` : ""}
                                    </td>

                                    <td className="py-3 pr-3 font-extrabold text-[var(--dad-ink)]">
                                        <Link
                                            href={`/admin/orders/${encodeURIComponent(o.orderNum)}`}
                                            className="hover:underline"
                                        >
                                            {o.orderNo}
                                        </Link>
                                    </td>

                                    <td className="py-3 pr-3">
                                        <div className="font-bold text-[var(--dad-ink)]">{o.buyerName}</div>
                                        <div className="text-xs font-bold text-[var(--dad-muted)]">
                                            {o.buyerPhone}
                                        </div>
                                    </td>

                                    <td className="py-3 pr-3">
                                        <div className="font-bold text-[var(--dad-ink)]">{o.receiverName}</div>
                                        <div className="text-xs font-bold text-[var(--dad-muted)]">
                                            {o.receiverPhone}
                                        </div>
                                    </td>

                                    <td className="py-3 pr-3 font-bold text-[var(--dad-ink)]">
                                        {Number(o.itemCount ?? 0)}건
                                    </td>

                                    <td className="py-3 pr-3">
                                        <OrderStatusSelect orderNum={o.orderNum} current={String(o.status)} />
                                    </td>

                                    <td className="py-3 pr-3">
                                            <span className="inline-flex items-center rounded-full border border-[var(--dad-border)] bg-white/70 px-3 py-1 text-xs font-extrabold text-[var(--dad-ink)]">
                                                {o.payStatusLabel}
                                            </span>
                                    </td>

                                    <td className="py-3 pr-3 text-right font-extrabold text-[var(--dad-ink)]">
                                        {Number(o.payTotal ?? 0).toLocaleString()}원
                                    </td>

                                    <td className="py-3 pr-3 text-xs font-bold text-[var(--dad-muted)]">
                                        {formatDateText(o.pickupAt)}
                                    </td>

                                    <td className="py-3 pr-3 text-xs font-bold text-[var(--dad-muted)]">
                                        {formatDateText(o.createdAt)}
                                    </td>
                                </tr>
                            ))}

                            {(data.rows || []).length === 0 && (
                                <tr>
                                    <td
                                        colSpan={10}
                                        className="py-10 text-center text-sm font-bold text-[var(--dad-muted)]"
                                    >
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
                            href={`/admin/orders?tenant=${encodeURIComponent(tenant)}&status=${encodeURIComponent(
                                status
                            )}&q=${encodeURIComponent(q)}&page=${Math.max(1, currentPage - 1)}`}
                        >
                            ← 이전
                        </a>
                        <a
                            className="dad-btn dad-btn-ghost px-4 py-2 text-sm"
                            href={`/admin/orders?tenant=${encodeURIComponent(tenant)}&status=${encodeURIComponent(
                                status
                            )}&q=${encodeURIComponent(q)}&page=${Math.min(totalPages, currentPage + 1)}`}
                        >
                            다음 →
                        </a>
                    </div>
                </div>
            </div>
        </main>
    );
}