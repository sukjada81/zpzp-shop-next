// src/app/api/seller/[tenant]/orders/route.ts
import { NextRequest, NextResponse } from "next/server";

type AnyObj = Record<string, any>;

function getApiBase() {
    return (process.env.API_BASE_URL || "http://127.0.0.1:4000").replace(/\/+$/, "");
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

    // 옵션없는 상품은 option_name 에 상품명이 그대로 저장돼 있어 중복된다 → 상품명과 같으면 옵션 생략
    const showOption = optionName !== "" && optionName !== firstName;

    const firstLabel =
        showOption && qty > 0
            ? `${firstName} / ${optionName} × ${qty}`
            : showOption
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

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ tenant: string }> | { tenant: string } }
) {
    try {
        const resolved = await Promise.resolve(context.params);
        const tenant = String(resolved?.tenant ?? "").trim();

        console.log("SELLER_ORDERS_ROUTE_HIT", {
            url: request.url,
            tenant,
            cookie: request.headers.get("cookie") || "",
            host: request.headers.get("host") || "",
        });

        if (!tenant) {
            return NextResponse.json(
                { ok: false, message: "tenant is required" },
                { status: 400 }
            );
        }

        const apiBase = getApiBase();
        const upstreamUrl = `${apiBase}/v1/seller/orders?page=1&limit=100`;

        console.log("SELLER_ORDERS_FETCH", {
            apiBase,
            upstreamUrl,
            tenant,
        });

        const res = await fetch(upstreamUrl, {
            method: "GET",
            headers: {
                accept: "application/json",
                cookie: request.headers.get("cookie") || "",
                "x-tenant-slug": tenant,
                "x-forwarded-host":
                    request.headers.get("host") || `${tenant}.discountallday.kr:3000`,
                "x-forwarded-proto": request.nextUrl.protocol.replace(":", "") || "http",
            },
            cache: "no-store",
        });

        console.log("SELLER_ORDERS_FETCH_STATUS", res.status);

        const text = await res.text();
        console.log("SELLER_ORDERS_FETCH_TEXT", text);

        let json: AnyObj | null = null;

        try {
            json = text ? JSON.parse(text) : null;
        } catch (err) {
            console.error("SELLER_ORDERS_JSON_PARSE_ERROR", err);
            json = null;
        }

        console.log("SELLER_ORDERS_RESPONSE", json);

        if (!res.ok) {
            return NextResponse.json(
                {
                    ok: false,
                    message:
                        json?.message ||
                        json?.error ||
                        "seller orders fetch failed",
                    detail: json ?? text,
                },
                { status: res.status || 500 }
            );
        }

        const rawItems = Array.isArray(json?.items) ? json.items : [];
        const items = rawItems.map(normalizeOrderItem);

        console.log("SELLER_ORDERS_NORMALIZED", {
            count: items.length,
            first: items[0] ?? null,
        });

        return NextResponse.json({
            ok: true,
            tenant,
            items,
            total: Number(json?.total ?? items.length),
            page: Number(json?.page ?? 1),
            limit: Number(json?.limit ?? 100),
        });
    } catch (error: any) {
        console.error("SELLER_ORDERS_ROUTE_ERROR", error);

        return NextResponse.json(
            {
                ok: false,
                message: error?.message || "seller orders route error",
            },
            { status: 500 }
        );
    }
}