import { NextRequest, NextResponse } from "next/server";

function apiBase() {
    return (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4000").replace(/\/+$/, "");
}

export async function proxyLinkerProducts(
    request: NextRequest,
    tenant: string,
    path: string,
) {
    if (!tenant) {
        return NextResponse.json({ ok: false, message: "tenant is required" }, { status: 400 });
    }
    const target = new URL(path, apiBase());
    request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));
    const headers: HeadersInit = {
        accept: "application/json",
        "content-type": "application/json",
        cookie: request.headers.get("cookie") || "",
        "x-tenant-slug": tenant,
        "x-forwarded-host": request.headers.get("host") || "",
        "x-forwarded-proto": request.nextUrl.protocol.replace(":", "") || "http",
    };
    const hasBody = !["GET", "HEAD"].includes(request.method);
    try {
        const response = await fetch(target, {
            method: request.method,
            headers,
            body: hasBody ? await request.text() : undefined,
            cache: "no-store",
        });
        const payload = await response.json().catch(() => ({ ok: false, message: "잘못된 API 응답입니다." }));
        return NextResponse.json(payload, { status: response.status });
    } catch {
        return NextResponse.json({ ok: false, message: "링커 상품 API에 연결할 수 없습니다." }, { status: 502 });
    }
}
