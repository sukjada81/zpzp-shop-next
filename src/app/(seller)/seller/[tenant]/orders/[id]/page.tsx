// src/app/(seller)/seller/[tenant]/orders/[id]/page.tsx
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

type Props = {
    params: Promise<{ tenant: string; id: string }> | { tenant: string; id: string };
};

type OrderItem = {
    id: string;
    productId?: string;
    productName?: string;
    goodsName?: string;
    title?: string;
    optionName?: string;
    quantity?: number;
    qty?: number;
    price?: number;
    status?: number;
};

type OrderDetail = {
    id: string;
    orderNo: string;
    buyerName: string;
    amount: number;
    status?: number;
    statusLabel?: string;
    createdAtText?: string;
    phone?: string;
    memo?: string;
    address?: string;
    message?: string;
    receiverName?: string;
    receiverPhone?: string;
    items?: OrderItem[];
};

function normalizeHost(raw: string) {
    return String(raw || "")
        .split(",")[0]
        .trim();
}

function getProtocolFromHeaders(forwardedProto: string | null, host: string) {
    const proto = normalizeHost(forwardedProto || "").toLowerCase();
    if (proto === "http" || proto === "https") return proto;

    const lowerHost = String(host || "").toLowerCase();
    const isLocal =
        lowerHost.includes("localhost") ||
        lowerHost.includes("127.0.0.1") ||
        lowerHost.includes(":3000");

    return isLocal ? "http" : "https";
}

function getInternalBaseUrl(host: string, proto: string) {
    const envBase =
        process.env.NEXT_INTERNAL_ORIGIN ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_BASE_URL ||
        "";

    if (envBase) {
        return envBase.replace(/\/+$/, "");
    }

    const normalizedHost = normalizeHost(host) || "127.0.0.1:3000";
    const hasPort = normalizedHost.includes(":");

    if (
        normalizedHost.includes("localhost") ||
        normalizedHost.includes("127.0.0.1") ||
        normalizedHost.includes(":3000")
    ) {
        return `${proto}://${normalizedHost}`;
    }

    if (!hasPort && process.env.NODE_ENV !== "production") {
        return `${proto}://${normalizedHost}:3000`;
    }

    return `${proto}://${normalizedHost}`;
}

function toOrderDetail(data: any): OrderDetail | null {
    const raw = data?.order?.item ?? data?.order ?? data?.item ?? null;

    if (!raw) return null;

    return {
        id: String(raw?.id ?? ""),
        orderNo: String(raw?.orderNo ?? raw?.order_num ?? ""),
        buyerName: String(raw?.buyerName ?? raw?.name ?? ""),
        amount: Number(raw?.amount ?? raw?.pay_total ?? 0),
        status: raw?.status != null ? Number(raw.status) : undefined,
        statusLabel: raw?.statusLabel ? String(raw.statusLabel) : undefined,
        createdAtText: raw?.createdAtText ? String(raw.createdAtText) : "-",
        phone: raw?.phone ? String(raw.phone) : "",
        memo: raw?.memo ? String(raw.memo) : "",
        address: raw?.address ? String(raw.address) : "",
        message: raw?.message ? String(raw.message) : "",
        receiverName: raw?.receiverName ? String(raw.receiverName) : "",
        receiverPhone: raw?.receiverPhone ? String(raw.receiverPhone) : "",
        items: Array.isArray(raw?.items)
            ? raw.items.map((item: any) => ({
                id: String(item?.id ?? ""),
                productId: item?.productId != null ? String(item.productId) : undefined,
                productName: item?.productName ? String(item.productName) : undefined,
                goodsName: item?.goodsName ? String(item.goodsName) : undefined,
                title: item?.title ? String(item.title) : undefined,
                optionName: item?.optionName ? String(item.optionName) : undefined,
                quantity:
                    item?.quantity != null
                        ? Number(item.quantity)
                        : item?.qty != null
                            ? Number(item.qty)
                            : undefined,
                qty:
                    item?.qty != null
                        ? Number(item.qty)
                        : item?.quantity != null
                            ? Number(item.quantity)
                            : undefined,
                price: item?.price != null ? Number(item.price) : undefined,
                status: item?.status != null ? Number(item.status) : undefined,
            }))
            : [],
    };
}

async function getOrder(tenant: string, id: string) {
    const headerStore = await headers();

    const host =
        headerStore.get("x-forwarded-host") ||
        headerStore.get("host") ||
        "127.0.0.1:3000";

    const proto = getProtocolFromHeaders(
        headerStore.get("x-forwarded-proto"),
        host
    );

    const cookie = headerStore.get("cookie") || "";
    const baseUrl = getInternalBaseUrl(host, proto);

    const res = await fetch(`${baseUrl}/api/seller/${tenant}/orders/${id}`, {
        headers: {
            cookie,
            ...(headerStore.get("x-forwarded-host")
                ? { "x-forwarded-host": headerStore.get("x-forwarded-host") as string }
                : {}),
            ...(headerStore.get("x-forwarded-proto")
                ? { "x-forwarded-proto": headerStore.get("x-forwarded-proto") as string }
                : {}),
            ...(host ? { host: normalizeHost(host) } : {}),
        },
        cache: "no-store",
    });

    const text = await res.text().catch(() => "");
    let json: any = null;

    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }

    if (!res.ok) {
        throw new Error(`ORDER_DETAIL_FETCH_FAILED:${res.status}:${text || "null"}`);
    }

    return json;
}

function getItemName(item: OrderItem) {
    return item.productName || item.title || item.goodsName || "상품명 없음";
}

function getItemQty(item: OrderItem) {
    const qty = item.quantity ?? item.qty ?? 0;
    return Number.isFinite(qty) ? qty : 0;
}

export default async function OrderDetailPage({ params }: Props) {
    const resolved = await Promise.resolve(params);
    const tenant = resolved?.tenant;
    const id = resolved?.id;

    if (!tenant || !id) {
        notFound();
    }

    const data = await getOrder(tenant, id);
    const order = toOrderDetail(data);

    if (!data?.ok || !order) {
        return (
            <div className="p-4">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    주문 정보를 찾을 수 없습니다.
                </div>
                <div className="mt-4">
                    <Link
                        href={`/seller/${tenant}/orders`}
                        className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                    >
                        주문 목록으로
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-lg font-bold">주문 상세</h1>
                <Link
                    href={`/seller/${tenant}/orders`}
                    className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                >
                    목록으로
                </Link>
            </div>

            <div className="rounded-lg border p-4">
                <div className="grid gap-2 text-sm md:grid-cols-2">
                    <div>
                        <span className="font-semibold">주문번호:</span> {order.orderNo || "-"}
                    </div>
                    <div>
                        <span className="font-semibold">주문상태:</span> {order.statusLabel || "-"}
                    </div>
                    <div>
                        <span className="font-semibold">주문자:</span> {order.buyerName || "-"}
                    </div>
                    <div>
                        <span className="font-semibold">연락처:</span> {order.phone || "-"}
                    </div>
                    <div>
                        <span className="font-semibold">주문금액:</span>{" "}
                        {(order.amount ?? 0).toLocaleString()}원
                    </div>
                    <div>
                        <span className="font-semibold">주문일:</span> {order.createdAtText || "-"}
                    </div>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                    <div>
                        <span className="font-semibold">주소:</span> {order.address || "-"}
                    </div>
                    <div>
                        <span className="font-semibold">메모:</span> {order.memo || "-"}
                    </div>
                    <div>
                        <span className="font-semibold">요청사항:</span> {order.message || "-"}
                    </div>
                    <div>
                        <span className="font-semibold">수령인:</span> {order.receiverName || "-"}
                    </div>
                    <div>
                        <span className="font-semibold">수령인 연락처:</span> {order.receiverPhone || "-"}
                    </div>
                </div>
            </div>

            <div className="rounded-lg border p-4">
                <div className="mb-3 font-semibold">상품 내역</div>

                {order.items && order.items.length > 0 ? (
                    <div className="space-y-3">
                        {order.items.map((item) => (
                            <div key={item.id} className="rounded-md border border-slate-200 p-3">
                                <div className="font-medium">{getItemName(item)}</div>
                                <div className="mt-1 text-sm text-slate-600">
                                    옵션: {item.optionName || "-"}
                                </div>
                                <div className="mt-1 text-sm text-slate-600">
                                    수량: {getItemQty(item)}개
                                </div>
                                <div className="mt-1 text-sm text-slate-600">
                                    금액: {(item.price ?? 0).toLocaleString()}원
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-slate-500">상품 내역이 없습니다.</div>
                )}
            </div>
        </div>
    );
}