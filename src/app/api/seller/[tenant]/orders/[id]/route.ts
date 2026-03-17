// src/app/api/seller/[tenant]/orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

type AnyObj = Record<string, any>;

function getApiBase() {
    return (
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:4000"
    ).replace(/\/+$/, "");
}

function toNumber(value: unknown, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toText(value: unknown, fallback = "") {
    const s = String(value ?? "").trim();
    return s || fallback;
}

function parseDateLike(v: unknown): Date | null {
    if (!v) return null;
    const d = new Date(v as any);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(value: unknown) {
    const d = parseDateLike(value);
    if (!d) return "-";

    return d.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function normalizeOrderItem(row: AnyObj) {
    return {
        id: toText(row?.id ?? row?.uid),
        productId: toText(row?.productId ?? row?.product_id ?? row?.g_uid),
        title: toText(row?.title ?? row?.productName ?? row?.goodsName ?? row?.g_name),
        goodsCode: toText(row?.goodsCode ?? row?.goods_code ?? row?.g_code),
        price: toNumber(row?.price, 0),
        origPrice: toNumber(row?.origPrice ?? row?.orig_price, 0),
        qty: toNumber(row?.qty ?? row?.quantity, 0),
        optionId: toNumber(row?.optionId ?? row?.option_id ?? row?.option, 0),
        optionName: toText(row?.optionName ?? row?.option_name),
        status: toNumber(row?.status, 0),
        status2: toNumber(row?.status2, 0),
        createdAt: toText(
            row?.createdAt ?? row?.created_at ?? row?.created_at_dt,
            ""
        ),
    };
}

function normalizeOrderDetail(raw: AnyObj | null) {
    if (!raw) return null;

    const itemRows = Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw?.rows)
            ? raw.rows
            : [];

    const createdAtRaw =
        raw?.createdAt ??
        raw?.created_at ??
        raw?.created_at_dt ??
        raw?.createdAtText;

    return {
        id: toText(raw?.id ?? raw?.uid),
        orderNo: toText(raw?.orderNo ?? raw?.order_num),
        buyerName: toText(raw?.buyerName ?? raw?.buyer_name ?? raw?.name, "주문자"),
        amount: toNumber(raw?.amount ?? raw?.pay_total ?? raw?.payTotal, 0),
        status: toNumber(raw?.status, 0),
        statusLabel: toText(raw?.statusLabel ?? raw?.status_label),
        createdAt: toText(
            raw?.createdAt ?? raw?.created_at ?? raw?.created_at_dt,
            ""
        ),
        createdAtText: toText(raw?.createdAtText, formatDateTime(createdAtRaw)),
        phone: toText(raw?.phone ?? raw?.cell),
        memo: toText(raw?.memo),
        address: toText(raw?.address),
        message: toText(raw?.message),
        receiverName: toText(raw?.receiverName ?? raw?.receiver_name ?? raw?.name2),
        receiverPhone: toText(raw?.receiverPhone ?? raw?.receiver_phone ?? raw?.cell2),
        items: itemRows.map(normalizeOrderItem),
    };
}

export async function GET(
    req: NextRequest,
    context:
        | { params: { tenant: string; id: string } }
        | { params: Promise<{ tenant: string; id: string }> }
) {
    const params = await Promise.resolve(context.params);
    const tenant = String(params?.tenant ?? "").trim();
    const id = String(params?.id ?? "").trim();

    if (!tenant || !id) {
        return NextResponse.json(
            { ok: false, message: "tenant and id are required" },
            { status: 400 }
        );
    }

    try {
        const res = await fetch(`${getApiBase()}/v1/seller/orders/${encodeURIComponent(id)}`, {
            method: "GET",
            headers: {
                accept: "application/json",
                cookie: req.headers.get("cookie") || "",
                "x-tenant-slug": tenant,
            },
            cache: "no-store",
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
            return NextResponse.json(
                {
                    ok: false,
                    message: data?.message || "상세 조회 실패",
                },
                { status: res.status || 500 }
            );
        }

        const rawItem =
            data?.item ??
            data?.order?.item ??
            data?.order ??
            data?.data?.item ??
            data?.data ??
            null;

        const item = normalizeOrderDetail(rawItem);

        if (!item) {
            return NextResponse.json(
                { ok: false, message: "주문 상세 데이터가 없습니다." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            ok: true,
            tenant,
            item,
        });
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, message: e?.message || "주문 상세 조회 중 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}