// src/app/api/seller/[tenant]/orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

function getApiBase() {
    return (process.env.API_BASE_URL || "http://127.0.0.1:4000").replace(/\/+$/, "");
}

function toNumber(value: unknown, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function formatDateText(v: any): string {
    if (!v) return "-";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "-";

    return d.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function normalizeDetailItem(item: any) {
    const rows = Array.isArray(item?.items)
        ? item.items.map((row: any) => ({
            uid: toNumber(row?.id ?? row?.uid, 0),
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
            name: String(
                row?.productName ??
                row?.goodsName ??
                row?.title ??
                row?.g_name ??
                ""
            ),
            optionName: String(row?.optionName ?? row?.option_name ?? ""),
            optionValue: String(row?.optionValue ?? row?.option_name ?? ""),
            quantity: toNumber(row?.quantity ?? row?.qty, 0),
            qty: toNumber(row?.qty ?? row?.quantity, 0),
            price: toNumber(row?.price, 0),
            amount: toNumber(row?.price, 0),
            status: toNumber(row?.status, 0),
            createdAt: row?.createdAt ?? row?.created_at ?? null,
        }))
        : [];

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
        message: String(item?.message ?? ""),
        receiverName: String(item?.receiverName ?? item?.name2 ?? ""),
        receiverPhone: String(item?.receiverPhone ?? item?.cell2 ?? ""),
        items: rows,
    };
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ tenant: string; id: string }> | { tenant: string; id: string } }
) {
    try {
        const resolved = await Promise.resolve(context.params);
        const tenant = String(resolved?.tenant ?? "").trim();
        const id = String(resolved?.id ?? "").trim();

        if (!tenant) {
            return NextResponse.json(
                { ok: false, message: "tenant is required" },
                { status: 400 }
            );
        }

        if (!id) {
            return NextResponse.json(
                { ok: false, message: "id is required" },
                { status: 400 }
            );
        }

        const apiBase = getApiBase();
        const upstreamUrl = `${apiBase}/v1/seller/orders/${encodeURIComponent(id)}`;

        const res = await fetch(upstreamUrl, {
            method: "GET",
            headers: {
                accept: "application/json",
                cookie: request.headers.get("cookie") || "",
                "x-tenant-slug": tenant,
                "x-forwarded-host":
                    request.headers.get("host") || `${tenant}.zpzp.kr:3000`,
                "x-forwarded-proto": request.nextUrl.protocol.replace(":", "") || "http",
            },
            cache: "no-store",
        });

        const text = await res.text();
        let json: any = null;

        try {
            json = text ? JSON.parse(text) : null;
        } catch {
            json = null;
        }

        if (!res.ok) {
            return NextResponse.json(
                {
                    ok: false,
                    message: json?.message || json?.error || "seller order detail fetch failed",
                    detail: json ?? text,
                },
                { status: res.status || 500 }
            );
        }

        const item = normalizeDetailItem(json?.item ?? {});

        return NextResponse.json({
            ok: true,
            tenant,
            item,
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                ok: false,
                message: error?.message || "seller order detail route error",
            },
            { status: 500 }
        );
    }
}