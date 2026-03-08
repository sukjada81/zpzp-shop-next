// src/app/api/admin/session/page.tsx
import { NextResponse } from "next/server";

function baseApi() {
    // ✅ Next 서버에서 API 서버로 호출 (환경에 맞게 맞추세요)
    // - 로컬: http://localhost:4000
    // - 배포: process.env.API_BASE_URL
    return process.env.API_BASE_URL || "http://localhost:4000";
}

export async function GET(req: Request) {
    const url = new URL("/admin/auth/session", baseApi());

    // ✅ 쿠키(세션) 전달
    const cookie = req.headers.get("cookie") || "";

    const res = await fetch(url, {
        method: "GET",
        headers: { cookie },
        cache: "no-store",
    });

    if (!res.ok) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    const data = await res.json().catch(() => ({ ok: false }));
    return NextResponse.json(data, { status: 200 });
}