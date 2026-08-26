// src/app/api/admin/scope/route.ts
import { NextResponse } from "next/server";
import { ADMIN_LINKER_COOKIE, normalizeLinkerScopeValue } from "@/lib/admin/linkerScope";

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const linker = normalizeLinkerScopeValue(body?.linker);

    const res = NextResponse.json({ ok: true, linker });
    res.cookies.set(ADMIN_LINKER_COOKIE, linker, {
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 180,
    });
    return res;
}
