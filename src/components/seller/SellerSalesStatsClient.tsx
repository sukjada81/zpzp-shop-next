// src/components/seller/SellerSalesStatsClient.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    Search,
    RotateCcw,
    ChevronLeft,
    ChevronRight,
    Wallet,
    Package,
    ShoppingBag,
    TrendingUp,
} from "lucide-react";
import {
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";
import { getSellerHref } from "@/lib/seller/getSellerHref";
import type {
    SellerSalesResponse,
    SellerDashboardTone,
    SellerSalesRange,
} from "@/lib/types/seller";

function toneNumberClass(tone: SellerDashboardTone) {
    switch (tone) {
        case "green":
            return "text-emerald-600";
        case "blue":
            return "text-blue-600";
        case "orange":
            return "text-amber-600";
        case "red":
            return "text-rose-500";
        default:
            return "text-slate-900";
    }
}

function toneSoftClass(tone: SellerDashboardTone) {
    switch (tone) {
        case "green":
            return "bg-emerald-50 text-emerald-700 ring-emerald-100";
        case "blue":
            return "bg-blue-50 text-blue-700 ring-blue-100";
        case "orange":
            return "bg-amber-50 text-amber-700 ring-amber-100";
        case "red":
            return "bg-rose-50 text-rose-700 ring-rose-100";
        default:
            return "bg-slate-50 text-slate-700 ring-slate-100";
    }
}

function cardIcon(key: string) {
    switch (key) {
        case "todaySales":
            return Wallet;
        case "monthSales":
            return TrendingUp;
        case "yearSales":
            return TrendingUp;
        case "rangeOrderCount":
            return ShoppingBag;
        default:
            return Package;
    }
}

function statusBadgeClass(status: number) {
    if (status === 9) return "bg-rose-50 text-rose-600 ring-rose-100";
    if (status === 4) return "bg-emerald-50 text-emerald-600 ring-emerald-100";
    if (status === 0 || status === 1 || status === 2) {
        return "bg-blue-50 text-blue-600 ring-blue-100";
    }
    return "bg-slate-100 text-slate-600 ring-slate-200";
}

function formatMoney(value: number) {
    return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function formatCount(value: number) {
    return `${Number(value || 0).toLocaleString("ko-KR")}건`;
}

function SalesTooltip({
                          active,
                          payload,
                          label,
                      }: {
    active?: boolean;
    payload?: Array<{ dataKey?: string; value?: number }>;
    label?: string;
}) {
    if (!active || !payload?.length) return null;

    const amount = Number(payload.find((item) => item.dataKey === "amount")?.value || 0);
    const orderCount = Number(payload.find((item) => item.dataKey === "orderCount")?.value || 0);

    return (
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
            <div className="text-xs font-semibold text-slate-500">{label}</div>
            <div className="mt-2 space-y-1 text-sm">
                <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-slate-600">매출</span>
                    <span className="ml-auto font-bold text-slate-900">{formatMoney(amount)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />
                    <span className="text-slate-600">주문수</span>
                    <span className="ml-auto font-bold text-slate-900">{formatCount(orderCount)}</span>
                </div>
            </div>
        </div>
    );
}

export default function SellerSalesStatsClient({
                                                   tenant,
                                                   data,
                                               }: {
    tenant: string;
    data: SellerSalesResponse;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const currentSearchParams = useSearchParams();

    const filters = data.filters;
    const chart = data.summary.chart;

    const chartRows = useMemo(() => {
        return (chart.points || []).map((point) => ({
            label: point.label,
            amount: Number(point.amount || 0),
            orderCount: Number(point.orderCount || 0),
        }));
    }, [chart.points]);

    function buildHref(next: Record<string, string | number | undefined>) {
        const params = new URLSearchParams(currentSearchParams.toString());

        Object.entries(next).forEach(([key, value]) => {
            if (value == null || value === "" || value === "all") {
                params.delete(key);
            } else {
                params.set(key, String(value));
            }
        });

        const query = params.toString();
        return query ? `${pathname}?${query}` : pathname;
    }

    function movePage(page: number) {
        router.push(buildHref({ page }));
    }

    function changeRange(range: SellerSalesRange) {
        router.push(buildHref({ range, page: 1 }));
    }

    return (
        <div className="space-y-4">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-[26px] font-extrabold tracking-[-0.03em] text-slate-900">
                            {data.summary.title}
                        </h1>
                        <p className="mt-1 text-sm font-medium text-slate-500">
                            {data.summary.subtitle}
                        </p>
                    </div>

                    <Link
                        href={getSellerHref(tenant)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                        대시보드로 이동
                    </Link>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                    {data.summary.cards.map((item) => {
                        const Icon = cardIcon(item.key);

                        return (
                            <div
                                key={item.key}
                                className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                            >
                                <div className="mb-3 flex items-start justify-between gap-3">
                                    <div className="text-sm font-semibold tracking-[-0.02em] text-slate-900">
                                        {item.label}
                                    </div>
                                    <div className={`rounded-2xl p-2 ring-1 ${toneSoftClass(item.tone)}`}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                </div>

                                <div className={`text-[24px] font-extrabold tracking-[-0.04em] ${toneNumberClass(item.tone)}`}>
                                    {item.text}
                                </div>
                                <div className="mt-2 text-xs text-slate-500">{item.hint}</div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-semibold text-slate-500">선택구간 총매출</div>
                        <div className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                            {data.summary.totals.salesAmountText}
                        </div>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-semibold text-slate-500">선택구간 공급가</div>
                        <div className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                            {data.summary.totals.supplyAmountText}
                        </div>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-semibold text-slate-500">선택구간 예상마진</div>
                        <div className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-emerald-600">
                            {data.summary.totals.profitAmountText}
                        </div>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-semibold text-slate-500">선택구간 주문/수량</div>
                        <div className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                            {data.summary.totals.orderCountText} / {data.summary.totals.qtyText}
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-[18px] font-extrabold tracking-[-0.03em] text-slate-900">
                            매출 그래프
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                            매출과 주문 흐름을 기간별로 볼 수 있어요
                        </div>
                    </div>

                    <div className="inline-flex rounded-full bg-slate-100 p-1">
                        {(["day", "month", "year"] as SellerSalesRange[]).map((range) => {
                            const active = filters.range === range;
                            const label = range === "day" ? "일별" : range === "month" ? "월별" : "연별";

                            return (
                                <button
                                    key={range}
                                    type="button"
                                    onClick={() => changeRange(range)}
                                    className={[
                                        "rounded-full px-4 py-2 text-sm font-semibold transition",
                                        active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-white",
                                    ].join(" ")}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-4 h-[420px] rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="h-full rounded-[20px] bg-white p-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={chartRows}
                                margin={{ top: 8, right: 12, left: -20, bottom: 8 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 12, fill: "#64748B" }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    yAxisId="left"
                                    tick={{ fontSize: 12, fill: "#64748B" }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(value) => `${Number(value).toLocaleString("ko-KR")}`}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    allowDecimals={false}
                                    tick={{ fontSize: 12, fill: "#64748B" }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip content={<SalesTooltip />} />
                                <Legend
                                    wrapperStyle={{ fontSize: "12px" }}
                                    formatter={(value) => (
                                        <span className="text-slate-600">{value}</span>
                                    )}
                                />
                                <Bar
                                    yAxisId="left"
                                    dataKey="amount"
                                    name="매출"
                                    fill="#10B981"
                                    radius={[8, 8, 0, 0]}
                                    maxBarSize={42}
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="orderCount"
                                    name="주문수"
                                    stroke="#7C3AED"
                                    strokeWidth={3}
                                    dot={{ r: 4, strokeWidth: 2, fill: "#7C3AED" }}
                                    activeDot={{ r: 6 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <form
                action={pathname}
                method="GET"
                className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-[18px] font-extrabold tracking-[-0.03em] text-slate-900">
                            상세 내역 / 검색 / 필터
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                            주문번호 / 주문자 / 상품명 검색 및 상태 / 기간 필터
                        </div>
                    </div>

                    <Link
                        href={pathname}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                        <RotateCcw className="h-4 w-4" />
                        필터 초기화
                    </Link>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-5">
                    <input type="hidden" name="range" value={filters.range} />

                    <label className="xl:col-span-2">
                        <div className="mb-2 text-xs font-semibold text-slate-500">검색</div>
                        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3">
                            <Search className="h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                name="search"
                                defaultValue={filters.search}
                                placeholder="주문번호 / 주문자 / 상품명"
                                className="h-11 w-full rounded-2xl border-0 bg-transparent text-sm outline-none"
                            />
                        </div>
                    </label>

                    <label>
                        <div className="mb-2 text-xs font-semibold text-slate-500">상태</div>
                        <select
                            name="status"
                            defaultValue={filters.status}
                            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none"
                        >
                            <option value="all">전체</option>
                            <option value="0">주문접수</option>
                            <option value="1">현장결제완료</option>
                            <option value="2">픽업준비완료</option>
                            <option value="4">픽업완료</option>
                            <option value="9">주문취소</option>
                        </select>
                    </label>

                    <label>
                        <div className="mb-2 text-xs font-semibold text-slate-500">시작일</div>
                        <input
                            type="date"
                            name="dateFrom"
                            defaultValue={filters.dateFrom}
                            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none"
                        />
                    </label>

                    <label>
                        <div className="mb-2 text-xs font-semibold text-slate-500">종료일</div>
                        <input
                            type="date"
                            name="dateTo"
                            defaultValue={filters.dateTo}
                            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none"
                        />
                    </label>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                        검색 / 적용
                    </button>
                </div>
            </form>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-[18px] font-extrabold tracking-[-0.03em] text-slate-900">
                            매출 상세내역
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                            총 {data.details.totalCount.toLocaleString("ko-KR")}건
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    {data.details.items.length > 0 ? (
                        data.details.items.map((item) => (
                            <Link
                                key={item.id}
                                href={getSellerHref(tenant, `/orders/${item.orderNo}`)}
                                className="block rounded-[20px] border border-slate-200 bg-slate-50/60 p-4 transition hover:bg-white hover:shadow-sm"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="text-sm font-bold text-slate-900">
                                                주문번호 {item.orderNo}
                                            </div>
                                            <div
                                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusBadgeClass(
                                                    item.status
                                                )}`}
                                            >
                                                {item.statusLabel}
                                            </div>
                                        </div>

                                        <div className="mt-2 text-sm font-semibold text-slate-800">
                                            {item.itemSummary}
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                            <span>주문자: {item.buyerName}</span>
                                            <span>수량: {item.qty.toLocaleString("ko-KR")}개</span>
                                            <span>일시: {item.orderedAtText}</span>
                                        </div>
                                    </div>

                                    <div className="shrink-0 text-right">
                                        <div className="text-[18px] font-extrabold tracking-[-0.03em] text-slate-900">
                                            {item.amountText}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            공급가 {item.supplyAmountText}
                                        </div>
                                        <div className="mt-1 text-xs font-semibold text-emerald-600">
                                            예상마진 {item.profitAmountText}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            조회된 매출 내역이 없습니다.
                        </div>
                    )}
                </div>

                <div className="mt-5 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => movePage(Math.max(1, data.details.page - 1))}
                        disabled={data.details.page <= 1}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        이전
                    </button>

                    <div className="text-sm font-semibold text-slate-600">
                        {data.details.page} / {data.details.totalPages}
                    </div>

                    <button
                        type="button"
                        onClick={() => movePage(Math.min(data.details.totalPages, data.details.page + 1))}
                        disabled={data.details.page >= data.details.totalPages}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                    >
                        다음
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}