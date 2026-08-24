// src/app/auth/kakao/callback/route.ts
import { NextRequest } from "next/server";
import crypto from "crypto";
import { appendApiSetCookies } from "@/lib/auth/session-cookie";

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

/**
 * tenant 를 서브도메인으로 조립하면 안 되는 슬러그.
 * middleware.ts 의 RESERVED_SUBDOMAINS 와 같은 목록이다 — 거기서 tenant 로 취급하지 않으므로
 * <slug>.zpzp.kr 을 만들면 라우팅되는 페이지가 없어 404 가 난다.
 * 특히 hq: 링커 스토어의 라우트 tenant 가 hq(본사몰 카탈로그)라서, 상대 returnTo 와 만나면
 * https://hq.zpzp.kr/home 이 조립돼 카카오 로그인 직후 404 가 났다.
 */
const NON_TENANT_SLUGS = new Set([
    "www",
    "admin",
    "auth",
    "api",
    "select-tenant",
    "seller",
    "hq",
]);

function isNonTenantSlug(tenant: string) {
    const t = (tenant || "").trim().toLowerCase();
    return !t || NON_TENANT_SLUGS.has(t);
}

function selectTenantOrigin() {
    return process.env.SELECT_TENANT_ORIGIN || "https://select-tenant.zpzp.kr";
}

function sellerConsoleOrigin() {
    return (
        process.env.SELLER_ORIGIN ||
        `https://seller.${process.env.TENANT_BASE_DOMAIN || "zpzp.kr"}`
    ).replace(/\/+$/, "");
}

function buildTenantOrigin(req: NextRequest, tenant: string) {
    // 서브도메인으로 세울 수 없는 슬러그면 조립하지 않고 점포 선택으로 보낸다.
    if (isNonTenantSlug(tenant)) return selectTenantOrigin();

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

/**
 * 미가입자 인계용 — 본사 간편가입 진입점의 서명 URL을 만든다.
 *
 * 서명 규약은 shop-php lib/internal_auth.php 와 동일해야 한다(zpzpInternalSign):
 *   HMAC-SHA256( `${ts}\n${canonical}` , ZPZP_INTERNAL_SECRET )
 * canonical 은 kakao_signup_entry.php 의 zpzpSignupCanonical() 과 **필드 순서까지** 같아야 한다.
 * 어긋나면 가입 진입이 400으로 막히므로, 한쪽만 고치지 말 것.
 */
function buildHqSignupUrl(input: {
    snsId: string;
    snsType: string;
    email: string;
    name: string;
    returnTo: string;
}): string {
    const base =
        process.env.HQ_SIGNUP_URL || "https://zpzp.kr/php/kakao_signup_entry.php";

    // ★시크릿 미설정을 조용히 넘기지 않는다.
    //   종전엔 `|| ""` 폴백만 있어서, 이 웹 프로세스(.env.production)에 시크릿이 없으면
    //   빈 키로 서명한 URL을 정상인 척 발급했다. PHP 쪽은 당연히 signature mismatch 400 →
    //   "가입 화면이 안 뜬다"로만 보이고 원인이 콜백 로그 어디에도 안 남았다(2026-08-09 실측).
    //   apps/api/src/lib/php-bridge.ts 의 bridgeSecret() 과 같은 규약으로 즉시 throw 한다.
    const secret = String(process.env.ZPZP_INTERNAL_SECRET || "");
    if (secret.length < 32) {
        throw new Error("ZPZP_INTERNAL_SECRET is missing or too short (min 32 chars).");
    }
    const ts = Math.floor(Date.now() / 1000).toString();

    const canonical =
        `sns_id=${input.snsId}` +
        `&sns_type=${input.snsType}` +
        `&email=${input.email}` +
        `&name=${input.name}` +
        `&returnTo=${input.returnTo}`;

    const sign = crypto
        .createHmac("sha256", secret)
        .update(`${ts}\n${canonical}`)
        .digest("hex");

    // 시크릿 지문(값이 아니라 sha256 앞 8자리) — PHP 쪽 로그의 지문과 대조하면
    // "시크릿 불일치"인지 "canonical 불일치"인지 로그만 보고 즉시 갈린다.
    const secretFp = crypto.createHash("sha256").update(secret).digest("hex").slice(0, 8);
    console.log("KAKAO_HQ_SIGNUP_SIGN", { ts, secretFp });

    const u = new URL(base);
    u.searchParams.set("sns_id", input.snsId);
    u.searchParams.set("sns_type", input.snsType);
    u.searchParams.set("email", input.email);
    u.searchParams.set("name", input.name);
    u.searchParams.set("returnTo", input.returnTo);
    u.searchParams.set("ts", ts);
    u.searchParams.set("sign", sign);
    return u.toString();
}

/**
 * 가입 완료 후 돌아올 절대 URL. 상대 경로면 요청 호스트 기준으로 절대화한다
 * (가입은 zpzp.kr 에서 끝나므로 상대 경로를 넘기면 본사로 돌아와 스토어 귀속이 끊긴다).
 * 최종 화이트리스트 판정은 PHP 쪽에서도 다시 한다.
 */
function resolveSignupReturnTo(req: NextRequest, returnTo: string): string {
    try {
        const origin = new URL(req.url).origin;
        const abs = isAbsoluteUrl(returnTo)
            ? returnTo
            : new URL(returnTo.startsWith("/") ? returnTo : "/home", origin).toString();
        const host = new URL(abs).hostname.toLowerCase();
        if (host === "zpzp.kr" || host.endsWith(".zpzp.kr")) return abs;
        return "";
    } catch {
        return "";
    }
}

function safeNextUrl(req: NextRequest, returnTo: string, tenant: string) {
    if (isAbsoluteUrl(returnTo)) return returnTo;
    const path = returnTo.startsWith("/") ? returnTo : "/home";

    // /{tenant}… 상대경로는 셀러 콘솔이다. 단 hq 등 예약 슬러그는 스토어 경로이므로 제외.
    // (tenant=hq + /hq/home 을 seller.zpzp.kr 로 보내면 안 된다)
    const t = String(tenant || "").trim().toLowerCase();
    if (
        t &&
        !isNonTenantSlug(t) &&
        (path === `/${t}` || path.startsWith(`/${t}/`))
    ) {
        return `${sellerConsoleOrigin()}${path}`;
    }

    // 폴백 origin 이 점포 선택이면 스토어 경로(/home 등)를 붙여봐야 의미가 없다 — 루트로 보낸다.
    const origin = buildTenantOrigin(req, tenant);
    if (isNonTenantSlug(tenant)) return new URL("/", origin).toString();

    return new URL(path, origin).toString();
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

function appendSetCookies(headers: Headers, res: Response, req: NextRequest) {
    appendApiSetCookies(headers, res, req);
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
        // DAD 잔재였던 하드코딩 기본값 "a" 제거 — 존재하지 않는 점포라 API 가 엉뚱한 테넌트로
        // 폴백했다. 빈 값이면 본사몰(hq) 카탈로그를 기본으로 쓴다.
        // 리다이렉트 목적지는 별개다 — safeNextUrl 이 hq 를 서브도메인으로 세우지 않고
        // 점포 선택으로 보낸다(NON_TENANT_SLUGS).
        const tenantSlug = String(tenant || "hq").trim().toLowerCase();

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
                // 본사 간편가입 폼으로 인계한다.
                //
                // 종전엔 php/login.php 로 보냈는데 그 파일은 인클루드 전용(`!defined('_B2BMALL_') → exit`)이라
                // 직접 열면 빈 화면으로 끝났고(2026-08-05 실측), 카카오 인증 결과와 returnTo 도 실리지 않아
                // 가입을 이어받을 수 없었다. → 전용 진입점 kakao_signup_entry.php 로 서명해서 넘긴다.
                //
                // sns_id 를 쿼리로 넘기는 이상 위조 진입 = 대리 가입 벡터이므로 HMAC 서명이 필수다.
                // 서명 규약은 내부 브리지와 동일(ZPZP_INTERNAL_SECRET, ts 포함, 5분 스큐).
                let hqSignupUrl: string;
                try {
                    hqSignupUrl = buildHqSignupUrl({
                        snsId: completePayload.providerUserId,
                        snsType: "kakao",
                        email: completePayload.email,
                        name: completePayload.name,
                        returnTo: resolveSignupReturnTo(req, returnTo),
                    });
                } catch (e) {
                    // 서명할 수 없으면 400 날 URL로 보내지 않는다 — 여기서 끊고 원인을 로그에 남긴다.
                    console.error("KAKAO_HQ_SIGNUP_SIGN_FAILED", (e as Error)?.message);
                    return Response.json(
                        { ok: false, error: "HQ_SIGNUP_LINK_UNAVAILABLE" },
                        { status: 500 }
                    );
                }

                const notReg = new Headers();
                notReg.set("Location", hqSignupUrl);
                console.log("KAKAO_NOT_REGISTERED_REDIRECT", hqSignupUrl.split("?")[0]);
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