// src/app/api/seller/[tenant]/products/page.tsx
import { NextRequest, NextResponse } from "next/server";

type AnyObj = Record<string, any>;

function toArray<T = AnyObj>(payload: any): T[] {
    if (Array.isArray(payload)) return payload as T[];
    if (Array.isArray(payload?.items)) return payload.items as T[];
    if (Array.isArray(payload?.data)) return payload.data as T[];
    if (Array.isArray(payload?.rows)) return payload.rows as T[];
    if (Array.isArray(payload?.products)) return payload.products as T[];
    return [];
}

function getTenantIdValue(item: AnyObj): string {
    return String(
        item?.tenant_id ??
        item?.tenantId ??
        item?.tenant?.id ??
        item?.tenant ??
        ""
    );
}

function getStatusValue(item: AnyObj): string {
    return String(item?.status ?? "").trim().toLowerCase();
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

async function fetchInternalJson(
    request: NextRequest,
    path: string
): Promise<any | null> {
    const url = new URL(path, request.nextUrl.origin);

    try {
        const res = await fetch(url.toString(), {
            method: "GET",
            headers: {
                cookie: request.headers.get("cookie") || "",
            },
            cache: "no-store",
        });

        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ tenant: string }> | { tenant: string } }
) {
    const resolved = await Promise.resolve(context.params);
    const tenant = resolved?.tenant;

    if (!tenant) {
        return NextResponse.json(
            { ok: false, message: "tenant is required" },
            { status: 400 }
        );
    }

    const productsRaw = await fetchInternalJson(
        request,
        `/api/admin/products?page=1&pageSize=2000&limit=2000`
    );

    const allProducts = toArray(productsRaw);
    const products = allProducts
        .filter((item) => getTenantIdValue(item) === String(tenant))
        .map((item) => ({
            id: String(item?.uid ?? item?.id ?? ""),
            tenant_id: String(item?.tenant_id ?? tenant),
            name: getName(item),
            price: getPrice(item),
            status: getStatusValue(item) || "draft",
            image: getImage(item),
            stock:
                Number(item?.stock ?? item?.qty ?? item?.quantity ?? item?.total_stock ?? 0) || 0,
            raw: item,
        }));

    return NextResponse.json({
        ok: true,
        tenant,
        items: products,
        total: products.length,
    });
}