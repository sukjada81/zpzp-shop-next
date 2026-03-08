import { NextResponse } from "next/server";

export async function GET(
    _req: Request,
    ctx: {
        params: Promise<{ tenant: string; id: string }> | { tenant: string; id: string };
    }
) {
    const { tenant, id } = await Promise.resolve(ctx.params);

    return NextResponse.json({
        ok: true,
        item: {
            id,
            name: "홍길동",
            phone: "010-1234-5678",
            status: "active",
            joinedAt: "2026-03-01",
            lastLoginAt: "2026-03-08",
            tenant,
            memo: "",
        },
    });
}