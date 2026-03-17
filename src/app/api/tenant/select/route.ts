// src/app/api/seller/[tenant]/orders/route.ts
import { NextRequest, NextResponse } from "next/server";

type AnyObj = Record<string, any>;

function getApiBase() {
    return (
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:4000"
    ).replace(/\/+$/, "");
}

function normalizeText(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function parseDateLike(v: any): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateText(v: any): string {
    const d = parseDateLike(v);
    if (!d) return "-";

    return d.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function buildSummaryFromItems(items: AnyObj[]) {
    if (!Array.isArray(items) || items.length === 0) return "";

    const first = items[0] || {};
    const firstName =
        normalizeText(first.productName) ||
        normalizeText(first.goodsName) ||
        normalizeText(first.title) ||
        normalizeText(first.name);

    const optionName =
        normalizeText(first.optionName) ||
        normalizeText(first.optionValue);

    const qty = toNumber(first.quantity ?? first.qty, 0);

    if (!firstName) return "";

    const firstLabel =
        optionName && qty > 0
            ? `${firstName} / ${optionName} × ${qty}`
            : optionName
                ? `${firstName} / ${optionName}`
                : qty > 0
                    ? `${firstName} × ${qty}`
                    : firstName;

    if (items.length === 1) return firstLabel;
    return `${firstLabel} 외 ${items.length - 1}건`;
}

function normalizeOrderItem(item: AnyObj) {
    const items = Array.isArray(item?.items)
        ? item.items.map((row: AnyObj) => ({
            id: String(row?.id ?? row?.uid ?? ""),
            productId: String(row?.productId ?? row?.product_id ?? row?.g_uid ?? ""),
            productName: String(
                row?.productName ??
                row?.goodsName ??
                row?.title ??
                row?.g_name ??
                ""
            ),
            goodsName: String(
                row?.goodsName ??
                row?.productName ??
                row?.title ??
                row?.g_name ??
                ""
            ),
            optionName: String(row?.optionName ?? row?.option_name ?? ""),
            optionValue: String(row?.optionValue ?? ""),
            quantity: toNumber(row?.quantity ?? row?.qty, 0),
            qty: toNumber(row?.qty ?? row?.quantity, 0),
            price: toNumber(row?.price, 0),
            status: toNumber(row?.status, 0),
        }))
        : [];

    const itemSummary =
        normalizeText(item?.itemSummary) ||
        normalizeText(item?.orderSummary) ||
        buildSummaryFromItems(items);

    return {
        id: String(item?.id ?? item?.uid ?? ""),
        orderNo: String(item?.orderNo ?? item?.order_num ?? ""),
        buyerName: String(item?.buyerName ?? item?.buyer_name ?? item?.name ?? "주문자"),
        amount: toNumber(item?.amount ?? item?.pay_total ?? item?.payTotal, 0),
        status: toNumber(item?.status, 0),
        statusLabel: String(item?.statusLabel ?? ""),
        createdAtText:
            normalizeText(item?.createdAtText) ||
            formatDateText(item?.createdAt ?? item?.created_at ?? item?.signdate),
        phone: String(item?.phone ?? item?.cell ?? ""),
        memo: String(item?.memo ?? ""),
        address: String(item?.address ?? ""),
        itemSummary,
        items,
    };
}

async function fetchBackend(request: NextRequest, tenant: string, path: string) {
    const res = await fetch(`${getApiBase()}${path}`, {
        method: "GET",
        headers: {
            accept: "application/json",
            cookie: request.headers.get("cookie") || "",
            "x-tenant-slug": tenant,
        },
        cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ tenant: string }> | { tenant: string } }
) {
    const resolved = await Promise.resolve(context.params);
    const tenant = String(resolved?.tenant ?? "").trim();

    if (!tenant) {
        return NextResponse.json(
            { ok: false, message: "tenant is required" },
            { status: 400 }
        );
    }

    const page = request.nextUrl.searchParams.get("page") ?? "1";
    const limit = request.nextUrl.searchParams.get("limit") ?? "100";
    const query = request.nextUrl.searchParams.get("query") ?? "";

    const path =
        `/v1/seller/orders?page=${encodeURIComponent(page)}` +
        `&limit=${encodeURIComponent(limit)}` +
        `&query=${encodeURIComponent(query)}`;

    const result = await fetchBackend(request, tenant, path);

    if (!result.ok) {
        return NextResponse.json(
            result.data ?? {
                ok: false,
                message: "seller orders fetch failed",
            },
            { status: result.status || 500 }
        );
    }

    const rawItems = Array.isArray(result.data?.items) ? result.data.items : [];
    const items = rawItems.map(normalizeOrderItem);

    return NextResponse.json({
        ok: true,
        tenant,
        items,
        total: Number(result.data?.total ?? items.length),
        page: Number(result.data?.page ?? page),
        limit: Number(result.data?.limit ?? limit),
    });
}