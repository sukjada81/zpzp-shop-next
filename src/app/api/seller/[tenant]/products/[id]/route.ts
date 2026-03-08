// src/app/api/seller/[tenant]/products/[id]/page.tsx
import { NextRequest, NextResponse } from "next/server";

type AnyObj = Record<string, any>;

function getTenantIdValue(item: AnyObj): string {
    return String(
        item?.tenant_id ??
        item?.tenantId ??
        item?.tenant?.id ??
        item?.tenant ??
        ""
    );
}

function getImage(item: AnyObj): string {
    return (
        item?.image1 ||
        item?.thumb ||
        item?.thumbnail ||
        item?.thumbnail_url ||
        item?.image ||
        ""
    );
}

function getName(item: AnyObj): string {
    return String(item?.name || item?.goodsnm || item?.title || "상품명 없음");
}

function getPrice(item: AnyObj): number {
    const raw = item?.price ?? item?.sell_price ?? item?.sale_price ?? 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
}

function getStock(item: AnyObj): number {
    const raw = item?.stock ?? item?.qty ?? item?.quantity ?? item?.total_stock ?? 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
}

async function fetchInternalJson(
    request: NextRequest,
    path: string
): Promise<{ ok: boolean; status: number; data: any }> {
    const url = new URL(path, request.nextUrl.origin);

    try {
        const res = await fetch(url.toString(), {
            method: "GET",
            headers: {
                cookie: request.headers.get("cookie") || "",
            },
            cache: "no-store",
        });

        const data = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, data };
    } catch {
        return { ok: false, status: 500, data: null };
    }
}

async function forwardInternalJson(
    request: NextRequest,
    path: string,
    method: "PUT",
    body: any
): Promise<{ ok: boolean; status: number; data: any }> {
    const url = new URL(path, request.nextUrl.origin);

    try {
        const res = await fetch(url.toString(), {
            method,
            headers: {
                "content-type": "application/json",
                accept: "application/json",
                cookie: request.headers.get("cookie") || "",
            },
            body: JSON.stringify(body),
            cache: "no-store",
        });

        const data = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, data };
    } catch {
        return { ok: false, status: 500, data: null };
    }
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ tenant: string; id: string }> | { tenant: string; id: string } }
) {
    const resolved = await Promise.resolve(context.params);
    const tenant = resolved?.tenant;
    const id = resolved?.id;

    if (!tenant || !id) {
        return NextResponse.json(
            { ok: false, message: "tenant and id are required" },
            { status: 400 }
        );
    }

    const result = await fetchInternalJson(request, `/api/admin/products/${encodeURIComponent(id)}`);

    if (!result.ok || !result.data) {
        return NextResponse.json(
            { ok: false, message: result.data?.message || "상품 정보를 찾을 수 없습니다." },
            { status: result.status || 404 }
        );
    }

    const rawProduct = result.data?.product ?? result.data?.item ?? result.data?.data ?? result.data;

    if (!rawProduct || getTenantIdValue(rawProduct) !== String(tenant)) {
        return NextResponse.json(
            { ok: false, message: "해당 매장 상품이 아닙니다." },
            { status: 404 }
        );
    }

    return NextResponse.json({
        ok: true,
        item: {
            id: String(rawProduct?.uid ?? rawProduct?.id ?? ""),
            tenant_id: String(rawProduct?.tenant_id ?? tenant),
            name: getName(rawProduct),
            price: getPrice(rawProduct),
            status: String(rawProduct?.status ?? "draft"),
            image: getImage(rawProduct),
            stock: getStock(rawProduct),
            detail: String(rawProduct?.detail ?? rawProduct?.shortDescription ?? ""),
            explains: String(rawProduct?.explains ?? rawProduct?.description ?? "<p></p>"),
            image1: String(rawProduct?.image1 ?? ""),
            image2: String(rawProduct?.image2 ?? ""),
            image3: String(rawProduct?.image3 ?? ""),
            raw: rawProduct,
        },
    });
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ tenant: string; id: string }> | { tenant: string; id: string } }
) {
    const resolved = await Promise.resolve(context.params);
    const tenant = resolved?.tenant;
    const id = resolved?.id;

    if (!tenant || !id) {
        return NextResponse.json(
            { ok: false, message: "tenant and id are required" },
            { status: 400 }
        );
    }

    const verify = await fetchInternalJson(request, `/api/admin/products/${encodeURIComponent(id)}`);
    const rawProduct = verify.data?.product ?? verify.data?.item ?? verify.data?.data ?? verify.data;

    if (!verify.ok || !rawProduct) {
        return NextResponse.json(
            { ok: false, message: verify.data?.message || "상품 정보를 찾을 수 없습니다." },
            { status: verify.status || 404 }
        );
    }

    if (getTenantIdValue(rawProduct) !== String(tenant)) {
        return NextResponse.json(
            { ok: false, message: "해당 매장 상품이 아닙니다." },
            { status: 403 }
        );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
        return NextResponse.json(
            { ok: false, message: "잘못된 요청입니다." },
            { status: 400 }
        );
    }

    const payload = {
        title: String(body?.name ?? body?.title ?? rawProduct?.name ?? "").trim(),
        status: String(body?.status ?? rawProduct?.status ?? "draft"),
        price: Number(body?.price ?? rawProduct?.price ?? 0),
        basePrice: Number(body?.price ?? rawProduct?.price ?? 0),
        qty: Number(body?.stock ?? rawProduct?.qty ?? 0),
        detail: String(body?.detail ?? rawProduct?.detail ?? ""),
        shortDescription: String(body?.detail ?? rawProduct?.detail ?? ""),
        explains: String(body?.explains ?? rawProduct?.explains ?? "<p></p>"),
        description: String(body?.explains ?? rawProduct?.explains ?? "<p></p>"),
    };

    const result = await forwardInternalJson(
        request,
        `/api/proxy/admin/products/${encodeURIComponent(id)}`,
        "PUT",
        payload
    );

    if (!result.ok) {
        return NextResponse.json(
            { ok: false, message: result.data?.message || "상품 저장에 실패했습니다." },
            { status: result.status || 500 }
        );
    }

    return NextResponse.json({
        ok: true,
        message: "상품 수정이 완료되었습니다.",
        data: result.data,
    });
}