// src/app/(site)/[tenant]/(app)/orders/[id]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { endpoints, tenantHeader } from "@/lib/api/endpoints";
import { loadGuestOrderRefs } from "@/lib/orders/guestOrderRefs";
import { toneByOrderStatus } from "@/lib/orders/customerOrderDisplay";

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
        postcode?: string;
        address1?: string;
        address2?: string;
        addressLine?: string;
        message?: string;
        memo?: string;
        totalAmount: number;
        cancelTotal: number;
        refundTotal: number;
        deliveryTotal: number;
        payType: string;
        payStatus: string;
        payTypeLabel?: string;
        payStatusLabel?: string;
        isOnlinePrepaid?: boolean;
        pickupAt?: string | null;
        status: number;
        status2?: number;
        statusLabel: string;
        displayStatus?: string;
        badgeText?: string | null;
        footerText?: string | null;
        canCancel?: boolean;
        cancelMode?: "immediate" | "request" | "none";
        canReturn?: boolean;
        canExchange?: boolean;
        createdAt?: string | null;
        statusDate?: string | null;
        items: OrderDetailItem[];
    };
    message?: string;
};

type CancelOrderResponse = {
    ok: boolean;
    orderNum?: string;
    status?: number;
    statusLabel?: string;
    message?: string;
};

function formatDateTime(value?: string | null) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
}

function formatMoney(value: number) {
    return `${Number(value ?? 0).toLocaleString()}원`;
}

type ClaimOrderResponse = {
    ok: boolean;
    statusLabel?: string;
    message?: string;
};

function formatAddress(order: NonNullable<OrderDetailResponse["order"]>) {
    const line = String(order.addressLine ?? "").trim();
    if (line) return line;

    return [order.postcode, order.address1, order.address2].filter(Boolean).join(" ").trim();
}

function toneByStatus(statusLabel: string) {
    return toneByOrderStatus(statusLabel);
}

function findGuestPhone(orderNum: string, tenant: string) {
    if (typeof window === "undefined") return "";

    const refs = loadGuestOrderRefs();
    const found = refs.find((row) => row.orderNum === orderNum && row.tenant === tenant);

    return String(found?.phone ?? "").replace(/[^\d]/g, "");
}

export default function OrderDetailPage() {
    const params = useParams<{ tenant: string; id: string }>();
    const router = useRouter();

    const tenant = String(params?.tenant ?? "").trim();
    const id = String(params?.id ?? "").trim();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [order, setOrder] = useState<OrderDetailResponse["order"] | null>(null);
    const [canceling, setCanceling] = useState(false);
    const [claiming, setClaiming] = useState<"return" | "exchange" | "">("");
    const [isGuestMode, setIsGuestMode] = useState(false);
    const [guestPhone, setGuestPhone] = useState("");

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

                const localGuestPhone = findGuestPhone(id, tenant);
                if (!cancelled) {
                    setGuestPhone(localGuestPhone);
                }

                let res = await fetch(endpoints.myOrderDetail(tenant, id), {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        ...tenantHeader(tenant),
                    },
                });

                if (res.status === 401 && localGuestPhone) {
                    setIsGuestMode(true);
                    res = await fetch(endpoints.guestOrderDetail(tenant, id, localGuestPhone), {
                        method: "GET",
                        credentials: "include",
                        cache: "no-store",
                        headers: {
                            Accept: "application/json",
                            ...tenantHeader(tenant),
                        },
                    });
                } else {
                    setIsGuestMode(false);
                }

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

    async function handleCancel() {
        if (!order?.orderNum || canceling) return;

        const ok = window.confirm("주문을 취소할까요?");
        if (!ok) return;

        try {
            setCanceling(true);

            let res: Response;

            if (isGuestMode) {
                res = await fetch(endpoints.guestCancelOrder(tenant, order.orderNum), {
                    method: "POST",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        ...tenantHeader(tenant),
                    },
                    body: JSON.stringify({ phone: guestPhone }),
                });
            } else {
                res = await fetch(endpoints.cancelOrder(tenant, order.orderNum), {
                    method: "POST",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        ...tenantHeader(tenant),
                    },
                });
            }

            const json = (await res.json().catch(() => null)) as CancelOrderResponse | null;

            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || `주문취소 실패 (HTTP ${res.status})`);
            }

            router.replace(`/${tenant}/orders?highlight=${encodeURIComponent(order.orderNum)}`);
            router.refresh();
        } catch (e: any) {
            alert(e?.message || "주문취소 처리 중 오류가 발생했습니다.");
        } finally {
            setCanceling(false);
        }
    }

    async function handleClaim(type: "return" | "exchange") {
        if (!order?.orderNum || claiming) return;

        const label = type === "return" ? "반품" : "교환";
        const ok = window.confirm(`${label} 요청을 접수할까요?`);
        if (!ok) return;

        try {
            setClaiming(type);

            const res = await fetch(endpoints.claimOrder(tenant, order.orderNum), {
                method: "POST",
                credentials: "include",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    ...tenantHeader(tenant),
                },
                body: JSON.stringify({ type }),
            });

            const json = (await res.json().catch(() => null)) as ClaimOrderResponse | null;

            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || `${label} 요청에 실패했습니다.`);
            }

            alert(json.message || `${label} 요청이 접수되었습니다.`);
            router.refresh();
            window.location.reload();
        } catch (e: any) {
            alert(e?.message || `${label} 요청 중 오류가 발생했습니다.`);
        } finally {
            setClaiming("");
        }
    }

    const tone = useMemo(
        () => toneByStatus(order?.displayStatus || order?.statusLabel || ""),
        [order?.displayStatus, order?.statusLabel]
    );

    const headerStatusText = order?.displayStatus || order?.statusLabel || "주문상세";

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
                    <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-slate-500">주문번호</div>
                        <div className="mt-1 break-all text-[15px] font-extrabold text-slate-900">
                            {order.orderNum}
                        </div>
                    </div>

                    <span
                        className={[
                            "inline-flex shrink-0 rounded-full border px-3 py-1 text-[11px] font-extrabold",
                            tone,
                        ].join(" ")}
                    >
                        {headerStatusText}
                    </span>
                </div>

                {order.badgeText ? (
                    <div className="mt-3 inline-flex rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-700">
                        {order.badgeText}
                    </div>
                ) : null}

                <div className="mt-4 grid gap-2 rounded-2xl bg-slate-50 p-3 text-sm">
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">주문일시</span>
                        <span className="text-right font-bold text-slate-900">
                            {formatDateTime(order.createdAt)}
                        </span>
                    </div>

                    {/* 줍줍은 배송 전용, 정책 변경 대비 보존 — "픽업 일자" 행 노출 중단
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">픽업 일자</span>
                        <span className="text-right font-bold text-slate-900">
                            {order.pickupDateText && order.pickupDateText.trim()
                                ? order.pickupDateText
                                : "-"}
                        </span>
                    </div>
                    */}

                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">상태 변경일시</span>
                        <span className="text-right font-bold text-slate-900">
                            {formatDateTime(order.statusDate)}
                        </span>
                    </div>

                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">결제 방식</span>
                        <span className="text-right font-bold text-slate-900">
                            {order.payTypeLabel || (order.isOnlinePrepaid ? "온라인 결제" : "-")}
                        </span>
                    </div>

                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">결제 상태</span>
                        <span className="text-right font-bold text-slate-900">
                            {order.payStatusLabel || "-"}
                        </span>
                    </div>
                </div>

                {order.footerText ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-[14px] font-bold text-slate-700">
                        {order.footerText}
                    </div>
                ) : null}

                {order.canCancel ? (
                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={canceling}
                        className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-[14px] font-extrabold text-rose-600 disabled:opacity-50"
                    >
                        {canceling
                            ? "처리 중..."
                            : order.cancelMode === "request"
                              ? "취소 요청"
                              : "주문 취소"}
                    </button>
                ) : null}

                {order.canReturn ? (
                    <div className="mt-3">
                        <button
                            type="button"
                            onClick={() => handleClaim("return")}
                            disabled={!!claiming}
                            className="flex h-12 w-full items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-[14px] font-extrabold text-violet-700 disabled:opacity-50"
                        >
                            {claiming === "return" ? "처리 중..." : "반품 요청"}
                        </button>
                    </div>
                ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">주문자 정보</div>

                <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">주문자</span>
                        <span className="text-right font-bold text-slate-900">
                            {order.buyerName || "-"}
                        </span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">연락처</span>
                        <span className="text-right font-bold text-slate-900">
                            {order.buyerPhone || "-"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">배송지</div>

                <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">수령인</span>
                        <span className="text-right font-bold text-slate-900">
                            {order.receiverName || "-"}
                        </span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="font-semibold text-slate-500">연락처</span>
                        <span className="text-right font-bold text-slate-900">
                            {order.receiverPhone || "-"}
                        </span>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="text-[12px] font-semibold text-slate-500">주소</div>
                        <div className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">
                            {formatAddress(order) || "-"}
                        </div>
                    </div>
                </div>

                {order.message ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                        <div className="text-[12px] font-semibold text-slate-500">요청사항</div>
                        <div className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">
                            {order.message}
                        </div>
                    </div>
                ) : null}

                {order.memo ? (
                    <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                        <div className="text-[12px] font-semibold text-slate-500">메모</div>
                        <div className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">
                            {order.memo}
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[15px] font-extrabold text-slate-900">주문 상품</div>

                <div className="mt-4 space-y-3">
                    {order.items.map((item, idx) => (
                        <div
                            key={`${item.id}_${idx}`}
                            className="rounded-xl border border-slate-200 p-3"
                        >
                            <div className="min-w-0">
                                <div className="line-clamp-2 font-extrabold text-slate-900">
                                    {item.title}
                                </div>

                                {item.optionName && item.optionName.trim() !== item.title.trim() ? (
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
                                    <span className="font-semibold text-slate-500">{item.qty}개</span>
                                    <span className="font-extrabold text-slate-900">
                                        {formatMoney(item.price * item.qty)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-sm">
                    <span className="font-semibold text-slate-500">상품 금액</span>
                    <span className="font-bold text-slate-900">
                        {formatMoney(order.totalAmount)}
                    </span>
                </div>

                {Number(order.deliveryTotal ?? 0) > 0 ? (
                    <div className="mt-2 flex justify-between text-sm">
                        <span className="font-semibold text-slate-500">배송비</span>
                        <span className="font-bold text-slate-900">
                            {formatMoney(Number(order.deliveryTotal))}
                        </span>
                    </div>
                ) : null}

                {Number(order.cancelTotal ?? 0) > 0 ? (
                    <div className="mt-2 flex justify-between text-sm">
                        <span className="font-semibold text-slate-500">취소 금액</span>
                        <span className="font-bold text-rose-600">
                            {formatMoney(Number(order.cancelTotal))}
                        </span>
                    </div>
                ) : null}

                <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-base font-extrabold">
                    <span className="text-slate-900">
                        {order.isOnlinePrepaid ? "총 결제 금액" : "총 결제 예정 금액"}
                    </span>
                    <span className="text-slate-900">{formatMoney(order.totalAmount)}</span>
                </div>
            </div>

            {!order.isOnlinePrepaid ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700 shadow-sm">
                    이 주문은 온라인 선결제가 아닌{" "}
                    <span className="font-extrabold">매장 오프라인 결제</span> 방식입니다. 방문 후
                    현장에서 결제해 주세요.
                </div>
            ) : null}
        </main>
    );
}