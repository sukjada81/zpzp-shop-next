// src/app/api/track-click/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const type = searchParams.get("type") ?? "";
    const id = searchParams.get("id") ?? "";
    const redirect = searchParams.get("redirect") ?? "";
    const franchise = searchParams.get("franchise") ?? "";

    if (!redirect) {
        return NextResponse.json(
            {
                ok: false,
                message: "redirect is required",
            },
            { status: 400 }
        );
    }

    try {
        const safeRedirect = new URL(redirect);

        console.log("TRACK_CLICK", {
            type,
            id,
            franchise,
            redirect: safeRedirect.toString(),
        });

        return NextResponse.redirect(safeRedirect.toString(), 302);
    } catch {
        return NextResponse.json(
            {
                ok: false,
                message: "invalid redirect url",
            },
            { status: 400 }
        );
    }
}