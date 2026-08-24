import type { NextRequest } from "next/server";

export function sharedCookieDomain() {
    return process.env.COOKIE_DOMAIN || ".zpzp.kr";
}

function getForwardedHost(req: NextRequest) {
    return (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
        .split(",")[0]
        .trim()
        .toLowerCase();
}

function isDevHttp(req: NextRequest) {
    const host = getForwardedHost(req);
    const proto = (req.headers.get("x-forwarded-proto") || "")
        .split(",")[0]
        .trim()
        .toLowerCase();
    return proto === "http" || host.includes(":3000");
}

function splitSetCookieString(raw: string) {
    return raw
        .split(/,(?=\s*[^;=]+=[^;]+)/g)
        .map((v) => v.trim())
        .filter(Boolean);
}

export function parseCookieValue(cookieHeader: string, name: string): string | null {
    if (!cookieHeader || !name) return null;
    // 동일 이름이 여러 개면(호스트 전용 + Domain) 마지막 값을 쓴다.
    let found: string | null = null;
    for (const part of cookieHeader.split(";")) {
        const idx = part.indexOf("=");
        if (idx < 0) continue;
        const key = part.slice(0, idx).trim();
        if (key !== name) continue;
        found = part.slice(idx + 1).trim();
    }
    return found;
}

export function extractSessionIdFromSetCookies(res: Response): string | null {
    const anyHeaders = res.headers as { getSetCookie?: () => string[] };
    const list =
        typeof anyHeaders.getSetCookie === "function"
            ? anyHeaders.getSetCookie()
            : splitSetCookieString(res.headers.get("set-cookie") || "");

    let found: string | null = null;
    for (const raw of list) {
        const first = raw.split(";")[0] || "";
        const idx = first.indexOf("=");
        if (idx < 0) continue;
        const name = first.slice(0, idx).trim();
        if (name !== "dad_admin_sid") continue;
        found = first.slice(idx + 1).trim();
    }
    return found;
}

/** 공유 Domain 세션 쿠키 강제 발급(+ 호스트 전용/구 Domain 정리) */
export function buildSharedSessionSetCookies(sessionId: string, req: NextRequest): string[] {
    const sid = String(sessionId || "").trim();
    if (!sid) return [];

    const domain = sharedCookieDomain();
    const dev = isDevHttp(req);
    const sameSite = dev ? "Lax" : "None";
    const securePart = dev ? "" : "; Secure";
    const results: string[] = [];

    // 호스트 전용 잔존 쿠키 제거
    results.push(
        `dad_admin_sid=; Path=/; HttpOnly; SameSite=${sameSite}${securePart}; Max-Age=0`
    );

    // Domain 스코프 잔존/교체
    if (domain && !dev) {
        results.push(
            `dad_admin_sid=; Path=/; Domain=${domain}; HttpOnly; SameSite=None; Secure; Max-Age=0`
        );
        results.push(
            [
                `dad_admin_sid=${sid}`,
                "Path=/",
                `Domain=${domain}`,
                "HttpOnly",
                "SameSite=None",
                "Secure",
                "Max-Age=604800",
            ].join("; ")
        );
    } else {
        results.push(
            [
                `dad_admin_sid=${sid}`,
                "Path=/",
                "HttpOnly",
                `SameSite=${sameSite}`,
                "Max-Age=604800",
            ].join("; ")
        );
    }

    return results;
}

export function attachSharedSessionCookie(
    headers: Headers,
    req: NextRequest,
    sessionId?: string | null
) {
    const sid =
        String(sessionId || "").trim() ||
        parseCookieValue(req.headers.get("cookie") || "", "dad_admin_sid");
    if (!sid) return false;
    for (const cookie of buildSharedSessionSetCookies(sid, req)) {
        headers.append("Set-Cookie", cookie);
    }
    return true;
}

/** API Set-Cookie → 브라우저용. dad_admin_sid Domain/SameSite 를 항상 재작성 */
export function normalizeSessionSetCookie(cookie: string, req: NextRequest): string[] {
    let out = cookie.trim();
    if (!out) return [];

    const cookieName = out.split(";")[0]?.split("=")[0]?.trim() || "";
    if (cookieName !== "dad_admin_sid") {
        if (isDevHttp(req)) {
            out = out.replace(/;\s*Secure/gi, "");
            if (/;\s*SameSite=None/i.test(out)) {
                out = out.replace(/;\s*SameSite=None/gi, "; SameSite=Lax");
            }
        }
        return [out];
    }

    const value = out.split(";")[0]?.split("=").slice(1).join("=") || "";
    return buildSharedSessionSetCookies(value, req);
}

export function appendApiSetCookies(headers: Headers, res: Response, req: NextRequest) {
    const anyHeaders = res.headers as { getSetCookie?: () => string[] };

    const list =
        typeof anyHeaders.getSetCookie === "function"
            ? anyHeaders.getSetCookie()
            : splitSetCookieString(res.headers.get("set-cookie") || "");

    for (const raw of list) {
        for (const normalized of normalizeSessionSetCookie(raw, req)) {
            headers.append("Set-Cookie", normalized);
        }
    }
}
