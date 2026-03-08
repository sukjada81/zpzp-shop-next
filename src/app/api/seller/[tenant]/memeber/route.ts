// src/app/api/seller/[tenant]/members/route.ts
// src/app/api/seller/[tenant]/members/route.ts
import { NextResponse } from "next/server";

export async function GET(
    _request: Request,
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

    return NextResponse.json({
        ok: true,
        tenant,
        summary: {
            todaySignups: 0,
            weekSignups: 0,
            todayInflows: 0,
            todayLogins: 0,
            sourceReady: false,
        },
        items: [
            {
                id: "1",
                name: "홍길동",
                phone: "010-1234-5678",
                status: "active",
                joinedAt: "2026-03-01",
                lastLoginAt: "2026-03-08",
            },
            {
                id: "2",
                name: "김철수",
                phone: "010-2222-3333",
                status: "active",
                joinedAt: "2026-03-02",
                lastLoginAt: "2026-03-09",
            },
        ],
    });
}