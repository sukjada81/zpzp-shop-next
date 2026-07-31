// src/lib/api/ssrHeaders.ts
import { cookies, headers } from "next/headers";

/** src/middleware.ts RESERVED_SUBDOMAINS 와 같은 목록 — 링커 스토어가 아닌 서브도메인 */
const RESERVED_SUBDOMAINS = new Set([
    "www",
    "admin",
    "auth",
    "api",
    "select-tenant",
    "seller",
    "hq",
]);

function storeSlugFromHost(host: string | null | undefined): string {
    const hostOnly = String(host ?? "").split(",")[0].split(":")[0].trim().toLowerCase();
    if (!hostOnly || hostOnly === "localhost") return "";
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly)) return "";

    const parts = hostOnly.split(".");
    if (parts.length < 3) return "";

    const sub = parts[0];
    if (!sub || RESERVED_SUBDOMAINS.has(sub)) return "";
    return sub;
}

/**
 * 서버 컴포넌트에서 /api/proxy 를 호출할 때 붙일 헤더.
 *
 * 왜 필요한가 — 스토어 페이지(home/goods/상세/groupbuys)는 상품을 **서버사이드**로
 * 가져온다. 이 fetch 는 브라우저 요청이 아니라 새로 만든 요청이라 세션 쿠키가 실리지 않는다.
 * API 의 마스킹 판정은 `isMemberLoggedIn(req)` = `req.session.member.uid` 라서,
 * 쿠키가 없으면 **로그인한 사용자에게도 masked=true(회원가)** 가 내려간다.
 * 프록시는 받은 쿠키를 그대로 상류로 넘기므로(api/proxy route), 여기서 실어주기만 하면 된다.
 *
 * 비로그인이면 쿠키가 없어 헤더도 안 붙고, 기존 비회원 마스킹 동작은 그대로다.
 *
 * x-zpzp-store-slug — **지금 보고 있는 링커 스토어**를 API 에 알려준다. 이 SSR fetch 는
 * 내부 origin(127.0.0.1:3000)으로 나가서 원래 호스트(sue-linker.zpzp.kr)가 지워지기 때문에,
 * API 가 호스트로는 어느 링커 스토어인지 알 수 없다. 이걸 안 실어 보내면 API 가 진열 기준을
 * zpzp_ref(귀속 쿠키)로 폴백하는데, 그 쿠키는 first-touch 라 다른 링커 값이 박혀 있을 수 있고
 * 그러면 스토어가 본사 카탈로그 전체로 보인다(2026-07-31 회귀).
 * 자세한 건 apps/api/src/modules/public/products.routes.ts getStoreSlug 주석 참고.
 */
export async function ssrHeaders(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};

    try {
        const store = await cookies();
        const cookie = store
            .getAll()
            .map((c) => `${c.name}=${c.value}`)
            .join("; ");

        if (cookie) out.cookie = cookie;
    } catch {
        // 정적 렌더 등 쿠키 컨텍스트가 없는 경우 — 비회원과 동일하게 취급
    }

    try {
        const h = await headers();
        const slug = storeSlugFromHost(h.get("x-forwarded-host") || h.get("host"));
        if (slug) out["x-zpzp-store-slug"] = slug;
    } catch {
        // 헤더 컨텍스트가 없으면 API 가 호스트/쿠키로 폴백한다
    }

    return out;
}
