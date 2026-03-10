// src/app/(site)/[tenant]/(app)/orders/[id]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { endpoints } from "@/lib/api/endpoints";

type OrderDetailItem = {
    id: string;
    productId: string;
    title: string;
    goodsCode?: string;
    price: number;
    origPrice: number;
    qty: number;
    optionId: number;
    optionName?: string;
    status: number;
    status2: number;
    createdAt?: string | null;
};

type OrderDetailResponse = {
    ok: boolean;
    tenant?: string;
    order?: {
        id: string;
        orderNum: string;
        buyerName: string;
        buyerPhone: string;
        receiverName: string;
        receiverPhone: string;
        message?: string;
        memo?: string;
        totalAmount: number;
        cancelTotal: number;
        refundTotal: number;
        deliveryTotal: number;
        payType: string;
        payStatus: string;
        pickupAt?: string | null;
        status: number;
        statusLabel: string;
        createdAt?: string | null;
        statusDate?: string | null;
        items: OrderDetailItem[];
    };
    message?: string;
};

function formatDateTime(value?: string | null) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
}

function statusTone(statusLabel: string) {
    if (statusLabel.includes("취소")) {
        return "bg-rose-50 border-rose-200 text-rose-700";
    }
    if (statusLabel.includes("픽업완료")) {
        return "bg-emerald-50 border-emerald-200 text-emerald-700";
    }
    if (statusLabel.includes("픽업준비")) {
        return "bg-amber-50 border-amber-200 text-amber-700";
    }
    if (statusLabel.includes("결제")) {
        return "bg-blue-50 border-blue-200 text-blue-700";
    }
    return "bg-slate-50 border-slate-200 text-slate-700";
}

export default function OrderDetailPage() {
    const params = useParams<{ tenant: string; id: string }>();
    const tenant = String(params?.tenant ?? "").trim();
    const id = String(params?.id ?? "").trim();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [order, setOrder] = useState<OrderDetailResponse["order"] | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!tenant || !id) {
                setError("주문 정보가 올바르지 않습니다.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError("");

                const res = await fetch(endpoints.myOrderDetail(tenant, id), {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                });

                const json = (await res.json().catch(() => null)) as OrderDetailResponse | null;

                if (cancelled) return;

                if (!res.ok || !json?.ok || !json?.order) {
                    setOrder(null);
                    setError(json?.message || "주문 정보를 불러오지 못했습니다.");
                    return;
                }

                setOrder(json.order);
            } catch {
                if (!cancelled) {
                    setOrder(null);
                    setError("주문 정보를 불러오는 중 오류가 발생했습니다.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [tenant, id]);

    const tone = useMemo(
        () => statusTone(order?.statusLabel ?? ""),
        [order?.statusLabel]
    );

    if (loading) {
        return (
            <main className="mx-auto max-w-[520px] px-4 pb-24 pt-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500 shadow-sm">
                    주문 정보를 불러오는 중입니다.
                </div>
            </main>
        );
    }

    if (!order) {
        return (
            <main className="mx-auto max-w-[520px] px-4 pb-24 pt-3">
                <div className="mb-3 flex items-center justify-between">
                    <Link
                        href={`/${tenant}/orders`}
                        className="rounded-xl border px-3 py-2 text-sm font-extrabold"
                    >
                        ← 주문내역
                    </Link>

                    <div className="text-sm font-extrabold">주문상세</div>

                    <div className="w-[78px]" />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <div className="text-[15px] font-extrabold text-slate-900">
                        주문 정보를 찾을 수 없습니다.
                    </div>
                    {error ? (
                        <div className="mt-2 text-xs font-semibold text-slate-500">{error}</div>
                    ) : null}
                </div>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24 pt-3">
            <div className="mb-3 flex items-center justify-between">
                <Link
                    href={`/${tenant}/orders`}
                    className="rounded-xl border px-3 py-2 text-sm font-extrabold"
                >
                    ← 주문내역
                </Link>

                <div className="text-sm font-extrabold">주문상세</div>

                <div className="w-[78px]" />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-[12px] font-semibold text-slate-500">주문번호</div>
                        <div className="mt-1 text-[15px] font-extrabold text-slate-900">
                            {order.orderNum}
                        </div>
                    </div>

                    <span
                        className={[
                            "inline-flex rounded-full border px-3 py-1 text-[11px] font-extrabold",
                            tone,
                        ].join(" ")}
                    >
                        {order.statusLabel}
                    </span>
                </div>

                <div className="mt-4 grid gap-2 rounded-2xl bg-slate-50 p-3 text-sm">
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">주문일시</span>
                        <span className="text-right font-bold text-slate-900">
                            {formatDateTime(order.createdAt)}
                        </span>
                    </div>

                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">픽업 예정일시</span>
                        <span className="text-right font-bold text-slate-900">
                            {formatDateTime(order.pickupAt)}
                        </span>
                    </div>

                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">상태 변경일시</span>
                        <span className="text-right font-bold text-slate-900">
                            {formatDateTime(order.statusDate)}
                        </span>
                    </div>

                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">결제 방식</span>
                        <span className="text-right font-bold text-slate-900">
                            오프라인 결제
                        </span>
                    </div>
                </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">주문자 정보</div>

                <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">주문자</span>
                        <span className="text-right font-bold text-slate-900">{order.buyerName}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">연락처</span>
                        <span className="text-right font-bold text-slate-900">{order.buyerPhone}</span>
                    </div>
                </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">수령 정보</div>

                <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">수령인</span>
                        <span className="text-right font-bold text-slate-900">{order.receiverName}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">연락처</span>
                        <span className="text-right font-bold text-slate-900">{order.receiverPhone}</span>
                    </div>
                </div>

                {order.message ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                        <div className="text-[12px] font-semibold text-slate-500">요청사항</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{order.message}</div>
                    </div>
                ) : null}

                {order.memo ? (
                    <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                        <div className="text-[12px] font-semibold text-slate-500">메모</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900 whitespace-pre-wrap">
                            {order.memo}
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">주문 상품</div>

                <div className="mt-4 space-y-3">
                    {order.items.map((item, idx) => (
                        <div key={`${item.id}_${idx}`} className="rounded-xl border border-slate-200 p-3">
                            <div className="min-w-0">
                                <div className="font-extrabold text-slate-900 line-clamp-2">
                                    {item.title}
                                </div>

                                {item.optionName ? (
                                    <div className="mt-1 text-[12px] font-semibold text-slate-500">
                                        옵션: {item.optionName}
                                    </div>
                                ) : null}

                                {item.goodsCode ? (
                                    <div className="mt-1 text-[11px] font-semibold text-slate-400">
                                        상품코드: {item.goodsCode}
                                    </div>
                                ) : null}

                                <div className="mt-3 flex items-center justify-between text-sm">
                                    <span className="font-semibold text-slate-500">
                                        {item.qty}개
                                    </span>
                                    <span className="font-extrabold text-slate-900">
                                        {(item.price * item.qty).toLocaleString()}원
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-sm">
                    <span className="font-semibold text-slate-500">상품 금액</span>
                    <span className="font-bold text-slate-900">
                        {order.totalAmount.toLocaleString()}원
                    </span>
                </div>

                {Number(order.deliveryTotal ?? 0) > 0 ? (
                    <div className="mt-2 flex justify-between text-sm">
                        <span className="font-semibold text-slate-500">배송비</span>
                        <span className="font-bold text-slate-900">
                            {Number(order.deliveryTotal).toLocaleString()}원
                        </span>
                    </div>
                ) : null}

                <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-base font-extrabold">
                    <span className="text-slate-900">총 결제 예정 금액</span>
                    <span className="text-slate-900">
                        {order.totalAmount.toLocaleString()}원
                    </span>
                </div>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700 shadow-sm">
                이 주문은 온라인 선결제가 아닌 <span className="font-extrabold">매장 오프라인 결제</span> 방식입니다.
                방문 후 현장에서 결제해 주세요.
            </div>
        </main>
    );
}