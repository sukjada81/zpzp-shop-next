// src/components/seller/SellerDashboardClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
    RefreshCw,
    ChevronRight,
    Store,
    ShoppingBag,
    Package,
    AlertCircle,
    UserPlus,
    Users,
    LogIn,
    TrendingUp,
    Wallet,
    CalendarDays,
    BarChart3,
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
import type { SellerDashboardData, SellerDashboardTone } from "@/lib/types/seller";

export type { SellerDashboardData };

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

function toneBarClass(tone: SellerDashboardTone) {
    switch (tone) {
        case "green":
            return "bg-emerald-400";
        case "blue":
            return "bg-blue-500";
        case "orange":
            return "bg-amber-500";
        case "red":
            return "bg-rose-400";
        default:
            return "bg-slate-400";
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
        case "todaySignups":
            return UserPlus;
        case "weekSignups":
            return Users;
        case "todayInflows":
            return TrendingUp;
        case "todayLogins":
            return LogIn;
        case "todayOrders":
            return ShoppingBag;
        case "pendingOrders":
            return AlertCircle;
        case "activeProducts":
            return Package;
        case "soldOutProducts":
            return Store;
        case "todaySales":
            return Wallet;
        case "monthSales":
            return CalendarDays;
        case "yearSales":
            return BarChart3;
        case "todaySalesOrders":
        case "rangeOrderCount":
            return ShoppingBag;
        default:
            return Store;
    }
}

function cardHref(tenant: string, key: string) {
    switch (key) {
        case "todaySignups":
        case "weekSignups":
        case "todayInflows":
        case "todayLogins":
            return getSellerHref(tenant, "/members");
        case "todayOrders":
        case "pendingOrders":
            return getSellerHref(tenant, "/orders");
        case "todaySales":
        case "monthSales":
        case "yearSales":
        case "todaySalesOrders":
        case "rangeOrderCount":
            return getSellerHref(tenant, "/sales");
        case "activeProducts":
        case "soldOutProducts":
            return getSellerHref(tenant, "/products");
        default:
            return getSellerHref(tenant);
    }
}

function formatMoney(value: number) {
    return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function formatCount(value: number) {
    return `${Number(value || 0).toLocaleString("ko-KR")}건`;
}

type ChartRow = {
    label: string;
    amount: number;
    orderCount: number;
};

function buildChartRows(data?: SellerDashboardData["summary"]["sales"]) {
    const points = data?.chart?.points ?? [];
    return points.map((point) => ({
        label: point.label,
        amount: Number(point.amount || 0),
        orderCount: Number(point.orderCount || 0),
    }));
}

function DashboardTooltip({
                              active,
                              payload,
                              label,
                          }: {
    active?: boolean;
    payload?: Array<{ dataKey?: string; value?: number; color?: string; name?: string }>;
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

export default function SellerDashboardClient({
                                                  tenant,
                                                  data,
                                              }: {
    tenant: string;
    data: SellerDashboardData;
}) {
    const [refreshing, setRefreshing] = useState(false);

    const summary = data?.summary;
    const sales = summary?.sales;

    const pageTitle = useMemo(() => {
        return summary?.title || `매장 ${tenant}`;
    }, [summary?.title, tenant]);

    const chartRows = useMemo(() => buildChartRows(sales), [sales]);

    function handleRefresh() {
        setRefreshing(true);
        window.location.reload();
    }

    return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="truncate text-[26px] font-extrabold tracking-[-0.03em] text-slate-900">
                        {pageTitle}
                    </h1>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        {summary?.subtitle || "매장 운영 현황"}
                    </p>
                </div>

                <div className="shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center">
                        <div className="flex h-9 items-center gap-2 border-r border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            실시간
                        </div>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="inline-flex h-9 items-center gap-2 bg-blue-600 px-4 text-xs font-bold text-white transition hover:bg-blue-700 active:translate-y-px"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                            새로고침
                        </button>
                    </div>
                </div>
            </div>

            <div className="my-4 h-px bg-slate-200" />

            <div className="mb-3 flex items-center justify-between px-1">
                <div className="text-sm font-medium tracking-[-0.02em] text-slate-700">
                    {summary?.dateLabel}
                </div>
                <Link
                    href={getSellerHref(tenant, "/members")}
                    className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600"
                >
                    <span>업데이트: {summary?.updatedAt}</span>
                    <ChevronRight className="h-4 w-4" />
                </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {summary?.memberKpis?.map((item) => {
                    const Icon = cardIcon(item.key);

                    return (
                        <Link
                            key={item.key}
                            href={cardHref(tenant, item.key)}
                            className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-[1px] hover:shadow-md"
                        >
                            <div className="mb-3 flex items-start justify-between gap-3">
                                <div className="text-sm font-semibold tracking-[-0.02em] text-slate-900">
                                    {item.label}
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-2 text-slate-500">
                                    <Icon className="h-4 w-4" />
                                </div>
                            </div>

                            <div className="flex items-end gap-1">
                                <span
                                    className={`text-[30px] font-extrabold leading-none tracking-[-0.04em] ${toneNumberClass(
                                        item.tone
                                    )}`}
                                >
                                    {item.value.toLocaleString("ko-KR")}
                                </span>
                                <span className="pb-0.5 text-sm font-semibold text-slate-700">
                                    {item.unit}
                                </span>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-500">
                                <span>{item.hint}</span>
                                <ChevronRight className="h-4 w-4" />
                            </div>
                        </Link>
                    );
                })}
            </div>

            <div className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                        <div className="text-[15px] font-bold tracking-[-0.02em] text-slate-900">
                            최근 7일
                        </div>
                        <div className="mt-1 text-xs text-slate-500">주문 흐름 요약</div>
                    </div>

                    <Link
                        href={getSellerHref(tenant, "/orders")}
                        className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600"
                    >
                        <span>주문 현황</span>
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {summary?.operationKpis?.map((item) => {
                        const Icon = cardIcon(item.key);

                        return (
                            <Link
                                key={item.key}
                                href={cardHref(tenant, item.key)}
                                className="rounded-[22px] border border-slate-200 bg-white p-4 transition hover:-translate-y-[1px] hover:shadow-md"
                            >
                                <div className="mb-3 flex items-start justify-between gap-3">
                                    <div className="text-sm font-semibold tracking-[-0.02em] text-slate-900">
                                        {item.label}
                                    </div>
                                    <div className="rounded-2xl bg-slate-50 p-2 text-slate-500">
                                        <Icon className="h-4 w-4" />
                                    </div>
                                </div>

                                <div className="flex items-end gap-1">
                                    <span
                                        className={`text-[30px] font-extrabold leading-none tracking-[-0.04em] ${toneNumberClass(
                                            item.tone
                                        )}`}
                                    >
                                        {item.value.toLocaleString("ko-KR")}
                                    </span>
                                    <span className="pb-0.5 text-sm font-semibold text-slate-700">
                                        {item.unit}
                                    </span>
                                </div>

                                <div className="mt-3 text-xs font-medium text-slate-500">{item.hint}</div>
                            </Link>
                        );
                    })}
                </div>

                <div className="mt-5 space-y-4">
                    {summary?.recentWeek?.rows?.map((row) => (
                        <Link key={row.key} href={getSellerHref(tenant, "/orders")} className="block">
                            <div className="mb-2 grid grid-cols-[1fr_auto] items-center gap-3">
                                <div className="text-sm font-semibold tracking-[-0.02em] text-slate-800">
                                    {row.label}
                                </div>
                                <div className="text-base font-bold tracking-[-0.03em] text-slate-900">
                                    {row.text}
                                </div>
                            </div>

                            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                                <div
                                    className={`h-full rounded-full transition-all ${toneBarClass(row.tone)}`}
                                    style={{ width: `${Math.max(6, row.percent)}%` }}
                                />
                            </div>
                        </Link>
                    ))}
                </div>

                <div className="mt-4 text-xs font-medium text-slate-500">
                    {summary?.recentWeek?.note}
                </div>
            </div>

            {sales ? (
                <div className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
                        <div>
                            <div className="text-[18px] font-extrabold tracking-[-0.03em] text-slate-900">
                                {sales.title}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">{sales.subtitle}</div>
                        </div>

                        <Link
                            href={getSellerHref(tenant, "/sales")}
                            className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600"
                        >
                            <span>매출통계 상세 보기</span>
                            <ChevronRight className="h-4 w-4" />
                        </Link>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                        {sales.cards?.map((item) => {
                            const Icon = cardIcon(item.key);

                            return (
                                <Link
                                    key={item.key}
                                    href={cardHref(tenant, item.key)}
                                    className="rounded-[22px] border border-slate-200 bg-white p-4 transition hover:-translate-y-[1px] hover:shadow-md"
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

                                    <div className="mt-3 text-xs font-medium text-slate-500">{item.hint}</div>
                                </Link>
                            );
                        })}
                    </div>

                    <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-[15px] font-bold tracking-[-0.02em] text-slate-900">
                                    매출 그래프
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                    최근 흐름을 한눈에 확인할 수 있어요
                                </div>
                            </div>
                        </div>

                        <div className="h-[320px] rounded-[20px] border border-slate-200 bg-white p-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    data={chartRows}
                                    margin={{ top: 8, right: 8, left: -20, bottom: 8 }}
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
                                    <Tooltip content={<DashboardTooltip />} />
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
                                        maxBarSize={36}
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

                        <div className="mt-4 flex justify-end">
                            <Link
                                href={getSellerHref(tenant, "/sales")}
                                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                                매출통계로 이동
                                <ChevronRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}