// src/components/seller/SellerOrderDetailClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    Package2,
    Phone,
    RefreshCw,
    User,
} from "lucide-react";
import { getSellerHref } from "@/lib/seller/getSellerHref";

type OrderLine = {
    uid?: number;
    productName?: string;
    goodsName?: string;
    name?: string;
    optionName?: string;
    optionValue?: string;
    quantity?: number;
    qty?: number;
    price?: number;
    amount?: number;
    categoryName?: string;
    categoryLabel?: string;
    category?: string;
    cate?: string | number;
    pickupDate?: string;
    pickupAt?: string;
    pickup_at?: string;
    pickupOnly?: boolean;
    pickup_only?: boolean;
    tab?: string;
    groupType?: string;
};

type OrderItem = {
    id: string;
    orderNo: string;
    buyerName: string;
    amount: number;
    status: number;
    statusLabel?: string;
    canCancel?: boolean;
    createdAtText: string;
    phone?: string;
    memo?: string;
    address?: string;
    itemSummary?: string;
    orderSummary?: string;
    productName?: string;
    goodsName?: string;
    saleEndAt?: string | null;
    saleEndAtText?: string | null;
    pickupStartAt?: string | null;
    pickupStartAtText?: string | null;
    pickupEndAt?: string | null;
    pickupEndAtText?: string | null;
    items?: OrderLine[];
};

function normalizeText(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function getStatusLabel(status?: number) {
    switch (status) {
        case 0:
            return "주문접수";
        case 1:
            return "현장결제완료";
        case 2:
            return "픽업준비완료";
        case 4:
            return "픽업완료";
        case 9:
            return "주문취소";
        default:
            return "알수없음";
    }
}

function statusBadge(status?: number) {
    if ([0, 1, 2].includes(Number(status))) {
        return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    }
    if (Number(status) === 4) {
        return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    }
    if (Number(status) === 9) {
        return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    }
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function getLineName(line: OrderLine) {
    return (
        normalizeText(line.productName) ||
        normalizeText(line.goodsName) ||
        normalizeText(line.name) ||
        "상품명 없음"
    );
}

function getLineOption(line: OrderLine) {
    const option = normalizeText(line.optionName) || normalizeText(line.optionValue);
    // 옵션없는 상품은 option_name 에 상품명이 그대로 저장돼 있어 중복 표시된다 → 상품명과 같으면 숨김
    if (option && option === getLineName(line)) return "";
    return option;
}

function getLineQty(line: OrderLine) {
    return toNumber(line.quantity ?? line.qty ?? 0);
}

function getLinePrice(line: OrderLine) {
    return toNumber(line.amount ?? line.price ?? 0);
}

function getCategoryLabel(line?: OrderLine) {
    return (
        normalizeText(line?.categoryLabel) ||
        normalizeText(line?.categoryName) ||
        normalizeText(line?.category) ||
        ""
    );
}

function getPickupDate(line?: OrderLine) {
    return (
        normalizeText(line?.pickupDate) ||
        normalizeText(line?.pickupAt) ||
        normalizeText(line?.pickup_at) ||
        ""
    );
}

function getGroupBadge(line?: OrderLine) {
    if (!line) return "";

    if (line.pickupOnly || line.pickup_only) return "바로픽업";

    const tab = normalizeText(line.tab).toLowerCase();
    const groupType = normalizeText(line.groupType).toLowerCase();

    if (tab === "today" || groupType === "today") return "오늘의 공구";
    if (tab === "ongoing" || groupType === "ongoing") return "진행중 공구";

    return "";
}

export default function SellerOrderDetailClient({
                                                    tenant,
                                                    id,
                                                }: {
    tenant: string;
    id: string;
}) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [loaded, setLoaded] = useState<OrderItem | null>(null);

    async function load() {
        try {
            setError("");

            const res = await fetch(`/api/seller/${tenant}/orders/${id}`, {
                cache: "no-store",
                credentials: "include",
            });
            const json = await res.json().catch(() => null);

            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || "주문 정보를 불러오지 못했습니다.");
            }

            const item = json.item as OrderItem;
            setLoaded(item);
        } catch (e: any) {
            setError(e?.message || "주문 정보를 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenant, id]);

    async function handleConfirm() {
        if (!loaded || loaded.status === 4 || loaded.status === 9) return;

        try {
            setSaving(true);
            setError("");

            const res = await fetch(`/api/seller/${tenant}/orders/${id}/status`, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "content-type": "application/json",
                    accept: "application/json",
                },
                body: JSON.stringify({ status: 4 }),
            });

            const json = await res.json().catch(() => null);

            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || "픽업완료 처리에 실패했습니다.");
            }

            await load();
            alert("픽업완료 처리되었습니다.");
        } catch (e: any) {
            setError(e?.message || "픽업완료 처리에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    }

    async function handleCancel() {
        if (!loaded || loaded.status === 9) return;
        if (!window.confirm("이 주문을 취소 처리하시겠습니까?")) return;

        try {
            setSaving(true);
            setError("");

            const res = await fetch(`/api/seller/${tenant}/orders/${id}/status`, {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "content-type": "application/json",
                    accept: "application/json",
                },
                body: JSON.stringify({ status: 9 }),
            });

            const json = await res.json().catch(() => null);

            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || "주문 취소에 실패했습니다.");
            }

            await load();
            alert("주문이 취소되었습니다.");
        } catch (e: any) {
            setError(e?.message || "주문 취소에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    }

    const firstItem = loaded?.items?.[0];

    const badges = useMemo(() => {
        const result: string[] = [];
        const groupBadge = getGroupBadge(firstItem);
        const category = getCategoryLabel(firstItem);

        if (groupBadge) result.push(groupBadge);
        if (category) result.push(category);

        return result;
    }, [firstItem]);

    if (loading) {
        return (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-40 rounded-xl bg-slate-100" />
                    <div className="h-40 rounded-3xl bg-slate-100" />
                    <div className="h-56 rounded-3xl bg-slate-100" />
                </div>
            </div>
        );
    }

    if (error && !loaded) {
        return (
            <div className="rounded-[28px] border border-rose-200 bg-white p-5 text-rose-700 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="text-base font-bold">주문 정보를 불러오지 못했습니다.</div>
                <div className="mt-2 text-sm">{error}</div>
                <Link
                    href={getSellerHref(tenant, "/orders")}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                    <ArrowLeft className="h-4 w-4" />
                    목록으로
                </Link>
            </div>
        );
    }

    const currentStatus = loaded?.status;
    const isDone = currentStatus === 4;
    const isCanceled = currentStatus === 9;
    const actionDisabled = saving || isDone || isCanceled;
    const canCancel = loaded?.canCancel ?? (currentStatus !== 9);
    const cancelDisabled = saving || isCanceled || !canCancel;
    const pickupDate = getPickupDate(firstItem);

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Seller Order
                    </div>
                    <div className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                        주문 상세
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                        주문 상태를 확인하고 확인 버튼으로 픽업완료 처리할 수 있습니다.
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href={getSellerHref(tenant, "/orders")}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        목록
                    </Link>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={actionDisabled}
                        className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        {saving ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4" />
                        )}
                        {isDone ? "픽업완료" : isCanceled ? "취소 주문" : saving ? "처리 중..." : "확인"}
                    </button>

                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={cancelDisabled}
                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                    >
                        {isCanceled ? "취소됨" : "주문 취소"}
                    </button>
                </div>
            </div>

            {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    {error}
                </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                <section className="space-y-5">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <div className="text-sm font-semibold text-slate-500">주문번호</div>
                                <div className="mt-2 text-xl font-bold tracking-[-0.03em] text-slate-900">
                                    {loaded?.orderNo}
                                </div>
                            </div>

                            <div>
                                <div className="text-sm font-semibold text-slate-500">주문상태</div>
                                <div className="mt-2">
                                    <span
                                        className={`rounded-full px-3 py-1.5 text-sm font-semibold ${statusBadge(currentStatus)}`}
                                    >
                                        {getStatusLabel(currentStatus)}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <div className="text-sm font-semibold text-slate-500">주문자</div>
                                <div className="mt-2 flex items-center gap-2 text-base font-semibold text-slate-900">
                                    <User className="h-4 w-4 text-slate-400" />
                                    <span>{loaded?.buyerName || "-"}</span>
                                </div>
                            </div>

                            <div>
                                <div className="text-sm font-semibold text-slate-500">연락처</div>
                                <div className="mt-2 flex items-center gap-2 text-base font-semibold text-slate-900">
                                    <Phone className="h-4 w-4 text-slate-400" />
                                    <span>{loaded?.phone || "-"}</span>
                                </div>
                            </div>

                            <div>
                                <div className="text-sm font-semibold text-slate-500">주문금액</div>
                                <div className="mt-2 text-base font-semibold text-slate-900">
                                    {(loaded?.amount ?? 0).toLocaleString("ko-KR")}원
                                </div>
                            </div>

                            <div>
                                <div className="text-sm font-semibold text-slate-500">주문일시</div>
                                <div className="mt-2 text-base font-semibold text-slate-900">
                                    {loaded?.createdAtText || "-"}
                                </div>
                            </div>

                            <div>
                                <div className="text-sm font-semibold text-slate-500">공구 마감일</div>
                                <div className="mt-2 text-base font-semibold text-slate-900">
                                    {loaded?.saleEndAtText || "-"}
                                </div>
                            </div>

                            <div>
                                <div className="text-sm font-semibold text-slate-500">픽업일</div>
                                <div className="mt-2 text-base font-semibold text-slate-900">
                                    {loaded?.pickupStartAtText
                                        ? loaded?.pickupEndAtText && loaded.pickupEndAtText !== loaded.pickupStartAtText
                                            ? `${loaded.pickupStartAtText} ~ ${loaded.pickupEndAtText}`
                                            : loaded.pickupStartAtText
                                        : loaded?.pickupEndAtText || "-"}
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <div className="text-sm font-semibold text-slate-500">주소</div>
                                <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                    {loaded?.address || "-"}
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <div className="text-sm font-semibold text-slate-500">주문메모</div>
                                <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                    {loaded?.memo || "-"}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                        <div className="mb-4">
                            <div className="text-lg font-bold tracking-[-0.03em] text-slate-900">
                                주문 상품
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                                주문에 포함된 상품과 옵션 정보를 확인합니다.
                            </div>
                        </div>

                        {loaded?.items?.length ? (
                            <div className="space-y-3">
                                {loaded.items.map((line, index) => {
                                    const name = getLineName(line);
                                    const option = getLineOption(line);
                                    const qty = getLineQty(line);
                                    const amount = getLinePrice(line);
                                    const category = getCategoryLabel(line);
                                    const linePickupDate = getPickupDate(line);
                                    const groupBadge = getGroupBadge(line);

                                    return (
                                        <div
                                            key={`${line.uid ?? "item"}-${index}`}
                                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                        >
                                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start gap-2">
                                                        <Package2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                                        <div className="min-w-0">
                                                            <div className="break-words text-base font-bold text-slate-900">
                                                                {name}
                                                            </div>

                                                            {option ? (
                                                                <div className="mt-1 text-sm text-slate-600">
                                                                    옵션: {option}
                                                                </div>
                                                            ) : null}

                                                            {(groupBadge || category) && (
                                                                <div className="mt-2 flex flex-wrap gap-2">
                                                                    {groupBadge ? (
                                                                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                                                                            {groupBadge}
                                                                        </span>
                                                                    ) : null}
                                                                    {category ? (
                                                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                                                                            {category}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                            )}

                                                            {linePickupDate ? (
                                                                <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                                                                    <CalendarDays className="h-3.5 w-3.5" />
                                                                    픽업 예정일 {linePickupDate}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex shrink-0 flex-row items-center gap-4 md:flex-col md:items-end md:gap-1">
                                                    <div className="text-sm text-slate-500">수량 {qty}개</div>
                                                    <div className="text-base font-bold text-slate-900">
                                                        {amount.toLocaleString("ko-KR")}원
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                                표시할 주문 상품 정보가 없습니다.
                            </div>
                        )}
                    </div>
                </section>

                <aside className="space-y-5">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                        <div className="text-lg font-bold tracking-[-0.03em] text-slate-900">
                            처리 안내
                        </div>
                        <div className="mt-3 text-sm leading-6 text-slate-600">
                            주문 상품을 고객에게 전달 완료했다면 확인 버튼을 눌러
                            픽업완료 상태로 변경하세요.
                        </div>

                        <div className="mt-4 space-y-2">
                            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                현재 상태:{" "}
                                <span className="font-semibold">{getStatusLabel(currentStatus)}</span>
                            </div>

                            {pickupDate ? (
                                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-200">
                                    픽업 예정일: <span className="font-semibold">{pickupDate}</span>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                        <div className="text-lg font-bold tracking-[-0.03em] text-slate-900">
                            주문 요약
                        </div>

                        <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">주문번호</span>
                                <span className="font-semibold text-slate-900">{loaded?.orderNo}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">주문자</span>
                                <span className="font-semibold text-slate-900">
                                    {loaded?.buyerName || "-"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">상품 수</span>
                                <span className="font-semibold text-slate-900">
                                    {loaded?.items?.length ?? 0}건
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">결제금액</span>
                                <span className="font-semibold text-slate-900">
                                    {(loaded?.amount ?? 0).toLocaleString("ko-KR")}원
                                </span>
                            </div>
                        </div>

                        {badges.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {badges.map((badge) => (
                                    <span
                                        key={badge}
                                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                                    >
                                        {badge}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </aside>
            </div>
        </div>
    );
}