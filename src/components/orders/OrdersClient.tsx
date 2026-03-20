// src/components/orders/OrdersClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, X, Zap } from "lucide-react";
import { endpoints } from "@/lib/api/endpoints";
import { loadGuestOrderRefs } from "@/lib/orders/guestOrderRefs";

type ApiOrderItem = {
    id: string;
    orderNum: string;
    buyerName?: string;
    buyerPhone?: string;
    totalAmount: number;
    pickupAt?: string | null;
    status: number;
    statusLabel: string;
    displayStatus?: string;
    badgeText?: string | null;
    footerText?: string | null;
    canCancel?: boolean;
    createdAt: string;
    items?: Array<{
        id: string;
        productId: string;
        title: string;
        price: number;
        qty: number;
        optionName?: string;
        status: number;
    }>;
};

type MyOrdersResponse = {
    ok: boolean;
    items?: ApiOrderItem[];
    message?: string;
};

type GuestOrdersResponse = {
    ok: boolean;
    items?: ApiOrderItem[];
    message?: string;
};

type CancelOrderResponse = {
    ok: boolean;
    orderNum?: string;
    status?: number;
    statusLabel?: string;
    message?: string;
};

type GuestProfile = {
    nickname?: string;
    phone?: string;
};

export type OrderSummary = {
    orderNo: string;
    status: string;
    title: string;
    totalPrice: number;
    createdAt: string;
    pickupAt?: string | null;
    badgeText?: string | null;
    footerText?: string | null;
    canCancel?: boolean;
    guestPhone?: string;
    lines: Array<{
        id: string;
        text: string;
        amount: number;
    }>;
};

function readQuickOrderProfilePhone(tenant: string): string {
    if (typeof window === "undefined") return "";

    try {
        const raw = localStorage.getItem(`profile:${tenant || "default"}`);
        if (!raw) return "";

        const parsed = JSON.parse(raw) as GuestProfile;
        return String(parsed?.phone ?? "").replace(/[^\d]/g, "");
    } catch {
        return "";
    }
}

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function formatOrderDateLabel(value?: string) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;

    const dayKor = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()] ?? "";
    return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}(${dayKor}) 주문`;
}

function formatMoney(v: number) {
    return `${Number(v ?? 0).toLocaleString()}원`;
}

function mapApiOrderToSummary(order: ApiOrderItem, guestPhone?: string): OrderSummary {
    const goods = Array.isArray(order.items) ? order.items : [];

    const lines = goods.map((item) => {
        const label = item.optionName?.trim()
            ? item.optionName.trim()
            : item.title;
        return {
            id: item.id,
            text: `${label} ${item.qty}개`,
            amount: Number(item.price ?? 0) * Number(item.qty ?? 0),
        };
    });

    const title =
        goods.length === 0
            ? order.orderNum
            : goods.length === 1
                ? goods[0]?.title ?? order.orderNum
                : `[${goods.length}건] ${goods[0]?.title ?? "주문 상품"}`;

    return {
        orderNo: order.orderNum,
        status: order.displayStatus || order.statusLabel || "주문접수",
        title,
        totalPrice: Number(order.totalAmount ?? 0),
        createdAt: order.createdAt,
        pickupAt: order.pickupAt ?? null,
        badgeText: order.badgeText ?? null,
        footerText: order.footerText ?? null,
        canCancel: Boolean(order.canCancel),
        guestPhone,
        lines,
    };
}

function dedupeOrders(items: OrderSummary[]) {
    const map = new Map<string, OrderSummary>();
    for (const item of items) {
        if (!item?.orderNo) continue;
        if (!map.has(item.orderNo)) {
            map.set(item.orderNo, item);
        }
    }
    return Array.from(map.values());
}

function getFooterVariant(text: string) {
    if (text.includes("미수령")) return "warning";
    if (text.includes("취소")) return "danger";
    if (text.includes("매장 방문 시 수령 가능")) return "pickup";
    if (text.includes("입고 예정일")) return "schedule";
    if (text.includes("픽업 기간")) return "schedule";
    return "default";
}

function getFooterClass(variant: string) {
    switch (variant) {
        case "warning":
            return "border-rose-200 bg-white text-rose-400";
        case "danger":
            return "border-rose-200 bg-rose-50 text-rose-500";
        case "pickup":
            return "border-slate-200 bg-white text-slate-400";
        case "schedule":
            return "border-slate-200 bg-white text-[#8fc59d]";
        default:
            return "border-slate-200 bg-white text-slate-400";
    }
}

function getFooterIcon(variant: string) {
    if (variant === "warning") {
        return <AlertTriangle size={15} className="shrink-0" />;
    }
    if (variant === "pickup") {
        return <Zap size={15} className="shrink-0" />;
    }
    if (variant === "schedule") {
        return <CalendarDays size={15} className="shrink-0" />;
    }
    return null;
}

function getBadgeClass(text: string) {
    if (text.includes("픽업 기간")) {
        return "border-[#cfd8ff] bg-[#eef2ff] text-[#6477d7]";
    }
    if (text.includes("픽업 예정")) {
        return "border-[#d6d6db] bg-[#efeff3] text-[#5f6470]";
    }
    return "border-[#d6d6db] bg-[#efeff3] text-[#5f6470]";
}

export default function OrdersClient(props: {
    tenant: string;
    initialOrders?: OrderSummary[];
}) {
    const { tenant } = props;

    const [orders, setOrders] = useState<OrderSummary[]>(props.initialOrders ?? []);
    const [loading, setLoading] = useState(!props.initialOrders);
    const [error, setError] = useState("");
    const [cancelingOrderNo, setCancelingOrderNo] = useState<string>("");

    const didFetchRef = useRef(false);

    const highlightOrderNo = useMemo(() => {
        if (typeof window === "undefined") return "";
        return new URLSearchParams(window.location.search).get("highlight") ?? "";
    }, []);

    const fetchGuestOrders = useCallback(async () => {
        const refs = loadGuestOrderRefs().filter((ref) => ref.tenant === tenant);
        const merged: OrderSummary[] = [];

        if (refs.length > 0) {
            const groupedPhoneMap = new Map<string, string[]>();

            for (const ref of refs) {
                const phone = String(ref.phone ?? "").replace(/[^\d]/g, "");
                if (!phone) continue;

                const list = groupedPhoneMap.get(phone) ?? [];
                list.push(ref.orderNum);
                groupedPhoneMap.set(phone, Array.from(new Set(list)));
            }

            for (const [phone, orderNums] of groupedPhoneMap.entries()) {
                const res = await fetch(endpoints.guestOrders(tenant), {
                    method: "POST",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify({
                        phone,
                        orderNums,
                    }),
                });

                const json = (await res.json().catch(() => ({}))) as GuestOrdersResponse;
                if (!res.ok || json.ok === false) continue;

                for (const item of json.items ?? []) {
                    merged.push(mapApiOrderToSummary(item, phone));
                }
            }
        } else {
            const phone = readQuickOrderProfilePhone(tenant);

            if (!phone) {
                setOrders([]);
                setError("");
                return;
            }

            const res = await fetch(endpoints.guestOrders(tenant), {
                method: "POST",
                credentials: "include",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    phone,
                    orderNums: [],
                }),
            });

            const json = (await res.json().catch(() => ({}))) as GuestOrdersResponse;
            if (res.ok && json.ok !== false) {
                for (const item of json.items ?? []) {
                    merged.push(mapApiOrderToSummary(item, phone));
                }
            }
        }

        const sorted = dedupeOrders(merged).sort((a, b) => {
            const at = new Date(a.createdAt || 0).getTime();
            const bt = new Date(b.createdAt || 0).getTime();
            return bt - at;
        });

        setOrders(sorted);
        setError("");
    }, [tenant]);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const res = await fetch(endpoints.myOrders(tenant, { page: 1, limit: 50 }), {
                method: "GET",
                credentials: "include",
                cache: "no-store",
                headers: {
                    Accept: "application/json",
                },
            });

            if (res.ok) {
                const json = (await res.json().catch(() => ({}))) as MyOrdersResponse;

                if (!json.ok) {
                    throw new Error(json.message || "주문내역 조회 실패");
                }

                const mine = (json.items ?? []).map((item) => mapApiOrderToSummary(item));

                if (mine.length > 0) {
                    setOrders(dedupeOrders(mine));
                    setError("");
                    return;
                }
            }

            await fetchGuestOrders();
        } catch (e: any) {
            try {
                await fetchGuestOrders();
            } catch {
                setError(e?.message || "주문내역을 불러오지 못했습니다.");
            }
        } finally {
            setLoading(false);
        }
    }, [tenant, fetchGuestOrders]);

    useEffect(() => {
        if (props.initialOrders && props.initialOrders.length > 0) return;
        if (didFetchRef.current) return;

        didFetchRef.current = true;
        fetchOrders();
    }, [props.initialOrders, fetchOrders]);

    async function handleCancel(orderNo: string, guestPhone?: string) {
        const ok = window.confirm("주문을 취소할까요?");
        if (!ok) return;

        setCancelingOrderNo(orderNo);

        try {
            let res: Response;

            if (guestPhone) {
                res = await fetch(endpoints.guestCancelOrder(tenant, orderNo), {
                    method: "POST",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify({ phone: guestPhone }),
                });
            } else {
                res = await fetch(endpoints.cancelOrder(tenant, orderNo), {
                    method: "POST",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                    },
                });
            }

            const json = (await res.json().catch(() => ({}))) as CancelOrderResponse;

            if (!res.ok || json.ok === false) {
                throw new Error(json.message || `주문취소 실패 (HTTP ${res.status})`);
            }

            await fetchOrders();
        } catch (e: any) {
            alert(e?.message || "주문취소 처리 중 오류가 발생했습니다.");
        } finally {
            setCancelingOrderNo("");
        }
    }

    return (
        <section className="space-y-4">
            {loading ? (
                <div className="rounded-[24px] border border-[#e5e5e5] bg-white p-6 text-center shadow-sm">
                    <div className="text-[14px] font-semibold text-[#7a7a7a]">
                        주문내역을 불러오는 중입니다.
                    </div>
                </div>
            ) : error ? (
                <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
                    <div className="text-[14px] font-semibold text-rose-700">{error}</div>
                    <button
                        type="button"
                        onClick={fetchOrders}
                        className="mt-3 inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm font-bold text-slate-800 shadow-sm"
                    >
                        다시 불러오기
                    </button>
                </div>
            ) : orders.length === 0 ? (
                <div className="rounded-[24px] border border-[#e5e5e5] bg-white p-6 text-center shadow-sm">
                    <div className="text-[15px] font-extrabold text-[#222]">주문내역이 없습니다</div>
                    <div className="mt-2 text-xs font-semibold text-[#888]">
                        주문을 완료하면 이곳에서 확인할 수 있어요.
                    </div>
                </div>
            ) : (
                orders.map((order) => {
                    const isHighlighted = highlightOrderNo === order.orderNo;
                    const href = `/${tenant}/orders/${encodeURIComponent(order.orderNo)}`;
                    const footerText = order.footerText || order.status;
                    const footerVariant = getFooterVariant(footerText);
                    const footerClass = getFooterClass(footerVariant);
                    const badgeClass = order.badgeText ? getBadgeClass(order.badgeText) : "";

                    return (
                        <article
                            key={order.orderNo}
                            className={[
                                "rounded-[24px] border bg-white px-5 pb-4 pt-4 shadow-sm",
                                isHighlighted
                                    ? "border-[color:var(--brand)] ring-2 ring-[color:var(--brand)]/10"
                                    : "border-[#e6e6e6]",
                            ].join(" ")}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="text-[13px] font-medium text-[#8f8f98]">
                                            {formatOrderDateLabel(order.createdAt)}
                                        </div>

                                        {order.badgeText ? (
                                            <span
                                                className={[
                                                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                                                    badgeClass,
                                                ].join(" ")}
                                            >
                                                <CalendarDays size={13} />
                                                <span>{order.badgeText}</span>
                                            </span>
                                        ) : null}
                                    </div>
                                </div>

                                {order.canCancel ? (
                                    <button
                                        type="button"
                                        onClick={() => handleCancel(order.orderNo, order.guestPhone)}
                                        disabled={cancelingOrderNo === order.orderNo}
                                        className="shrink-0 text-[#555] disabled:opacity-50"
                                        aria-label="주문 취소"
                                    >
                                        <X size={22} strokeWidth={2.2} />
                                    </button>
                                ) : null}
                            </div>

                            <Link href={href} className="mt-2 block">
                                <div className="text-[16px] font-extrabold leading-[1.45] tracking-[-0.02em] text-[#182032]">
                                    {order.title}
                                </div>

                                {order.lines.length > 0 ? (
                                    <div className="mt-3 space-y-2">
                                        {order.lines.map((line) => (
                                            <div
                                                key={line.id}
                                                className="flex items-start justify-between gap-3 text-[14px]"
                                            >
                                                <div className="min-w-0 flex-1 text-[#566072]">
                                                    {line.text}
                                                </div>
                                                <div className="shrink-0 font-semibold text-[#1f2940]">
                                                    {formatMoney(line.amount)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}

                                <div className="my-4 h-px bg-[#e8e8eb]" />

                                <div className="flex items-end justify-between gap-3">
                                    <div className="text-[15px] font-bold text-[#25324a]">
                                        주문금액
                                    </div>
                                    <div className="text-[20px] font-extrabold tracking-[-0.02em] text-[#182032]">
                                        {formatMoney(order.totalPrice)}
                                    </div>
                                </div>

                                <div
                                    className={[
                                        "mt-4 flex h-[46px] items-center justify-center gap-1 rounded-[14px] border text-[14px] font-bold",
                                        footerClass,
                                    ].join(" ")}
                                >
                                    {getFooterIcon(footerVariant)}
                                    <span>{footerText}</span>
                                </div>
                            </Link>
                        </article>
                    );
                })
            )}
        </section>
    );
}