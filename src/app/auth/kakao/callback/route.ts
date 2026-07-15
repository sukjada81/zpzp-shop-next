// src/app/auth/kakao/callback/route.ts
import { NextRequest } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

function base64urlToBuffer(s: string) {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    return Buffer.from(b64 + pad, "base64");
}

function verifyState(state: string, secret: string) {
    const parts = state.split(".");
    if (parts.length !== 2) {
        return { ok: false as const, error: "INVALID_STATE_FORMAT" };
    }

    const payloadBuf = base64urlToBuffer(parts[0]);
    const sigBuf = base64urlToBuffer(parts[1]);

    const expected = crypto.createHmac("sha256", secret).update(payloadBuf).digest();

    if (sigBuf.length !== expected.length) {
        return { ok: false as const, error: "INVALID_STATE_SIG" };
    }

    if (!crypto.timingSafeEqual(sigBuf, expected)) {
        return { ok: false as const, error: "INVALID_STATE_SIG" };
    }

    try {
        const payload = JSON.parse(payloadBuf.toString("utf8")) as {
            tenant?: string;
            returnTo?: string;
            nonce?: string;
            ts?: number;
        };
        return { ok: true as const, payload };
    } catch {
        return { ok: false as const, error: "INVALID_STATE_PAYLOAD" };
    }
}

function isAbsoluteUrl(s: string) {
    return /^https?:\/\//i.test(s);
}

function getHeaderFirst(req: NextRequest, key: string) {
    return (req.headers.get(key) || "").split(",")[0].trim();
}

function getForwardedProto(req: NextRequest) {
    return getHeaderFirst(req, "x-forwarded-proto").toLowerCase();
}

function getForwardedHost(req: NextRequest) {
    return getHeaderFirst(req, "x-forwarded-host") || getHeaderFirst(req, "host");
}

function isDevHttp(req: NextRequest) {
    const host = (getForwardedHost(req) || "").toLowerCase();
    const proto = getForwardedProto(req) || req.nextUrl.protocol.replace(":", "");
    return proto === "http" || host.includes(":3000");
}

function isLikelyLocalHost(host: string) {
    const h = (host || "").split(",")[0].trim().toLowerCase();
    const hostOnly = h.split(":")[0];
    if (!hostOnly) return true;
    if (hostOnly === "localhost") return true;
    if (hostOnly.endsWith(".localhost")) return true;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly)) return true;
    return false;
}

function cookieDomainForShare(req: NextRequest) {
    const host = (getForwardedHost(req) || "").split(",")[0].trim();
    if (isLikelyLocalHost(host)) return undefined;
    return process.env.COOKIE_DOMAIN || ".zpzp.kr";
}

function safeTenantSlug(raw: string) {
    const t = (raw || "").trim().toLowerCase();
    if (!t) return "";
    if (!/^[a-z0-9-]+$/.test(t)) return "";
    return t;
}

function buildTenantOrigin(req: NextRequest, tenant: string) {
    const baseDomain = process.env.TENANT_BASE_DOMAIN || "zpzp.kr";
    const dev = isDevHttp(req);
    const proto = dev ? "http" : "https";
    const localPort =
        process.env.NEXT_PUBLIC_LOCAL_TENANT_PORT ||
        process.env.LOCAL_TENANT_PORT ||
        "3000";
    const portPart = dev ? `:${localPort}` : "";
    return `${proto}://${tenant}.${baseDomain}${portPart}`;
}

function safeNextUrl(req: NextRequest, returnTo: string, tenant: string) {
    if (isAbsoluteUrl(returnTo)) return returnTo;
    const path = returnTo.startsWith("/") ? returnTo : "/home";
    return new URL(path, buildTenantOrigin(req, tenant)).toString();
}

async function exchangeKakaoToken(code: string, redirectUri: string) {
    const clientId = process.env.KAKAO_CLIENT_ID || "";
    const clientSecret = process.env.KAKAO_CLIENT_SECRET || "";

    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("client_id", clientId);
    body.set("redirect_uri", redirectUri);
    body.set("code", code);

    if (clientSecret) {
        body.set("client_secret", clientSecret);
    }

    const res = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        body,
        cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.access_token) {
        throw new Error(data?.error_description || data?.error || "KAKAO_TOKEN_FAILED");
    }

    return data;
}

async function fetchKakaoProfile(accessToken: string) {
    const res = await fetch("https://kapi.kakao.com/v2/user/me", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "content-type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.id) {
        throw new Error("KAKAO_PROFILE_FAILED");
    }

    return data;
}

function getApiBase() {
    return (
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:4000"
    ).replace(/\/+$/, "");
}

function buildSelectedTenantCookie(
    tenantSlug: string,
    domain: string | undefined,
    secure: boolean,
    sameSite: "None" | "Lax"
) {
    const parts = [
        `selectedTenant=${encodeURIComponent(tenantSlug)}`,
        "Path=/",
        "HttpOnly",
        `SameSite=${sameSite}`,
        "Max-Age=604800",
    ];

    if (domain) parts.push(`Domain=${domain}`);
    if (secure) parts.push("Secure");

    return parts.join("; ");
}

async function parseResponseBody(res: Response) {
    const text = await res.text();
    if (!text) return { text: "", json: null };

    try {
        return {
            text,
            json: JSON.parse(text),
        };
    } catch {
        return {
            text,
            json: null,
        };
    }
}

function splitSetCookieString(raw: string) {
    return raw
        .split(/,(?=\s*[^;=]+=[^;]+)/g)
        .map((v) => v.trim())
        .filter(Boolean);
}

function normalizeSetCookieForEnv(cookie: string, req: NextRequest) {
    // 운영은 그대로 유지
    if (!isDevHttp(req)) return cookie;

    let out = cookie;

    // 로컬/http 에서는 Secure 쿠키 저장이 안 될 수 있음
    out = out.replace(/;\s*Secure/gi, "");

    // SameSite=None 은 Secure와 같이 가야 하므로 dev에서는 Lax로 보정
    if (/;\s*SameSite=None/i.test(out)) {
        out = out.replace(/;\s*SameSite=None/gi, "; SameSite=Lax");
    }

    return out;
}

function appendSetCookies(headers: Headers, res: Response, req: NextRequest) {
    const anyHeaders: any = res.headers as any;

    if (typeof anyHeaders.getSetCookie === "function") {
        const all = anyHeaders.getSetCookie();
        for (const cookie of all) {
            headers.append("Set-Cookie", normalizeSetCookieForEnv(cookie, req));
        }
        return;
    }

    const raw = res.headers.get("set-cookie");
    if (!raw) return;

    for (const cookie of splitSetCookieString(raw)) {
        headers.append("Set-Cookie", normalizeSetCookieForEnv(cookie, req));
    }
}

export async function GET(req: NextRequest) {
    const url = req.nextUrl;
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (!state) {
        return Response.json({ ok: false, error: "Missing state" }, { status: 400 });
    }

    const authStateSecret = process.env.AUTH_STATE_SECRET;
    if (!authStateSecret) {
        return Response.json(
            { ok: false, error: "Missing env: AUTH_STATE_SECRET" },
            { status: 500 }
        );
    }

    const verified = verifyState(state, authStateSecret);
    if (!verified.ok) {
        return Response.json({ ok: false, error: verified.error }, { status: 400 });
    }

    const tenant = safeTenantSlug(verified.payload.tenant || "");
    const returnTo = verified.payload.returnTo || "/home";

    if (!code && error) {
        return Response.json(
            {
                ok: false,
                stage: "kakao_callback",
                error,
                error_description: errorDescription || "",
                tenant,
                returnTo,
            },
            { status: 400 }
        );
    }

    if (!code) {
        return Response.json(
            { ok: false, error: "Missing code", detail: errorDescription || "" },
            { status: 400 }
        );
    }

    const authOrigin = process.env.AUTH_ORIGIN || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const redirectUri = new URL("/auth/kakao/callback", authOrigin).toString();

    try {
        const token = await exchangeKakaoToken(code, redirectUri);
        const profile = await fetchKakaoProfile(token.access_token);

        const kakaoAccount = profile.kakao_account ?? {};
        const kakaoProfile = kakaoAccount.profile ?? {};
        const tenantSlug = String(tenant || "a").trim().toLowerCase();

        const completePayload = {
            tenantSlug,
            providerUserId: String(profile.id),
            email: String(kakaoAccount.email || ""),
            name: String(kakaoProfile.nickname || profile.properties?.nickname || ""),
            phone: String(kakaoAccount.phone_number || ""),
            profileImage: String(kakaoProfile.profile_image_url || ""),
            rawProfile: profile,
        };

        console.log("KAKAO_COMPLETE_REQUEST_URL", `${getApiBase()}/v1/auth/kakao/complete`);
        console.log("KAKAO_COMPLETE_REQUEST_PAYLOAD", completePayload);

        const completeRes = await fetch(`${getApiBase()}/v1/auth/kakao/complete`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                accept: "application/json",
                cookie: req.headers.get("cookie") || "",
                "x-tenant-slug": tenantSlug,
            },
            body: JSON.stringify(completePayload),
            cache: "no-store",
            redirect: "manual",
        });

        const { text: completeText, json: completeData } = await parseResponseBody(completeRes);

        console.log("KAKAO_COMPLETE_STATUS", completeRes.status);
        console.log("KAKAO_COMPLETE_TEXT", completeText);
        console.log("KAKAO_COMPLETE_SET_COOKIE", completeRes.headers.get("set-cookie"));

        if (!completeRes.ok) {
            // [줍줍] 미가입 카카오 유저는 자동생성하지 않고 본사(zpzp.kr) 가입/로그인으로 유도
            if (completeData?.code === "NOT_REGISTERED") {
                const hqLoginUrl =
                    process.env.HQ_LOGIN_URL || "https://zpzp.kr/php/login.php";
                const notReg = new Headers();
                notReg.set("Location", hqLoginUrl);
                console.log("KAKAO_NOT_REGISTERED_REDIRECT", hqLoginUrl);
                return new Response(null, { status: 302, headers: notReg });
            }
            return Response.json(
                {
                    ok: false,
                    error:
                        completeData?.error ||
                        completeData?.message ||
                        "AUTH_COMPLETE_FAILED",
                    detail: completeData ?? completeText ?? null,
                },
                { status: completeRes.status || 500 }
            );
        }

        const target = safeNextUrl(req, returnTo, tenantSlug);

        const dev = isDevHttp(req);
        const secure = dev ? false : true;
        const sameSite = secure ? "None" : "Lax";
        const domain = cookieDomainForShare(req);

        const headers = new Headers();
        headers.set("Location", target);

        // appendSetCookies(headers, completeRes);
        appendSetCookies(headers, completeRes, req);

        headers.append(
            "Set-Cookie",
            buildSelectedTenantCookie(tenantSlug, domain, secure, sameSite)
        );

        console.log("KAKAO_CALLBACK_REDIRECT_TARGET", target);

        return new Response(null, {
            status: 302,
            headers,
        });
    } catch (e: any) {
        console.error("KAKAO_CALLBACK_FATAL", e);

        return Response.json(
            { ok: false, error: e?.message || "KAKAO_CALLBACK_FAILED" },
            { status: 500 }
        );
    }
}