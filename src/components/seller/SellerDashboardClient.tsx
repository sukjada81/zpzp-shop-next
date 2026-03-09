// src/components/seller/SellerDashboardClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { getSellerHref } from "@/lib/seller/getSellerHref";

type Tone = "green" | "blue" | "orange" | "red";

type DashboardRow = {
    key: string;
    label: string;
    value: number;
    text: string;
    percent: number;
    tone: Tone;
};

type DashboardKpi = {
    key: string;
    label: string;
    value: number;
    unit: string;
    hint: string;
    tone: Exclude<Tone, "red">;
};

export type SellerDashboardData = {
    ok: boolean;
    tenant: string;
    summary: {
        title: string;
        subtitle: string;
        dateLabel: string;
        updatedAt: string;
        memberKpis: DashboardKpi[];
        operationKpis: DashboardKpi[];
        recentWeek: {
            total: number;
            rows: DashboardRow[];
            note: string;
        };
    };
};

function toneNumberClass(tone: Tone) {
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

function toneBarClass(tone: Tone) {
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
        case "activeProducts":
        case "soldOutProducts":
            return getSellerHref(tenant, "/products");
        default:
            return getSellerHref(tenant);
    }
}

export default function SellerDashboardClient({
                                                  tenant,
                                                  data,
                                              }: {
    tenant: string;
    data: SellerDashboardData;
}) {
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);

    const summary = data?.summary;

    const pageTitle = useMemo(() => {
        return summary?.title || `매장 ${tenant}`;
    }, [summary?.title, tenant]);

    function handleRefresh() {
        setRefreshing(true);
        router.refresh();
        setTimeout(() => setRefreshing(false), 700);
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
                                <span className={`text-[30px] font-extrabold leading-none tracking-[-0.04em] ${toneNumberClass(item.tone)}`}>
                                    {item.value.toLocaleString("ko-KR")}
                                </span>
                                <span className="pb-0.5 text-sm font-semibold text-slate-700">{item.unit}</span>
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
                        <div className="mt-1 text-xs text-slate-500">
                            주문 흐름 요약
                        </div>
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
                                    <span className={`text-[30px] font-extrabold leading-none tracking-[-0.04em] ${toneNumberClass(item.tone)}`}>
                                        {item.value.toLocaleString("ko-KR")}
                                    </span>
                                    <span className="pb-0.5 text-sm font-semibold text-slate-700">{item.unit}</span>
                                </div>

                                <div className="mt-3 text-xs font-medium text-slate-500">{item.hint}</div>
                            </Link>
                        );
                    })}
                </div>

                <div className="mt-5 space-y-4">
                    {summary?.recentWeek?.rows?.map((row) => (
                        <Link
                            key={row.key}
                            href={getSellerHref(tenant, "/orders")}
                            className="block"
                        >
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
        </div>
    );
}