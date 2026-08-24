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

/** API Set-Cookie → 브라우저용. dad_admin_sid 에 Domain=.zpzp.kr 보장 + auth 호스트 전용 쿠키 제거 */
export function normalizeSessionSetCookie(cookie: string, req: NextRequest): string[] {
    let out = cookie.trim();
    if (!out) return [];

    if (isDevHttp(req)) {
        out = out.replace(/;\s*Secure/gi, "");
        if (/;\s*SameSite=None/i.test(out)) {
            out = out.replace(/;\s*SameSite=None/gi, "; SameSite=Lax");
        }
    }

    const cookieName = out.split(";")[0]?.split("=")[0]?.trim() || "";
    const domain = sharedCookieDomain();
    const results: string[] = [];

    if (cookieName === "dad_admin_sid" && domain && !isDevHttp(req)) {
        if (!/;\s*Domain=/i.test(out)) {
            out += `; Domain=${domain}`;
        }
        const host = getForwardedHost(req);
        if (host.startsWith("auth.")) {
            // auth 에만 붙은 host-only 쿠키가 seller 에서 안 보이게 막는 경우 제거
            results.push(
                "dad_admin_sid=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0"
            );
        }
    }

    results.push(out);
    return results;
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
