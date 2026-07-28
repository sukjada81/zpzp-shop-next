// src/lib/api/ssrHeaders.ts
import { cookies } from "next/headers";

/**
 * 서버 컴포넌트에서 /api/proxy 를 호출할 때 붙일 헤더.
 *
 * 왜 필요한가 — 스토어 페이지(home/goods/상세/groupbuys)는 상품을 **서버사이드**로
 * 가져온다. 이 fetch 는 브라우저 요청이 아니라 새로 만든 요청이라 세션 쿠키가 실리지 않는다.
 * API 의 마스킹 판정은 `isMemberLoggedIn(req)` = `req.session.member.uid` 라서,
 * 쿠키가 없으면 **로그인한 사용자에게도 masked=true(?????원)** 가 내려간다.
 * 프록시는 받은 쿠키를 그대로 상류로 넘기므로(api/proxy route), 여기서 실어주기만 하면 된다.
 *
 * 비로그인이면 쿠키가 없어 헤더도 안 붙고, 기존 비회원 마스킹 동작은 그대로다.
 */
export async function ssrHeaders(): Promise<Record<string, string>> {
    try {
        const store = await cookies();
        const cookie = store
            .getAll()
            .map((c) => `${c.name}=${c.value}`)
            .join("; ");

        return cookie ? { cookie } : {};
    } catch {
        // 정적 렌더 등 쿠키 컨텍스트가 없는 경우 — 비회원과 동일하게 취급
        return {};
    }
}
