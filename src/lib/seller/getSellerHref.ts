// src/lib/seller/getSellerHref.ts
// "use client" 는 붙이지 않는다 — 붙이면 서버 컴포넌트가 순수 함수(getSellerHref/
// sellerBasePrefix)를 임포트할 때 클라이언트 참조가 돼 호출이 깨진다. 훅은 클라이언트
// 컴포넌트에서만 부르므로 지시자 없이도 안전하다.
import { usePathname } from "next/navigation";

/**
 * 셀러 콘솔은 두 경로공간에서 열린다.
 *   ① seller.zpzp.kr/{tenant}/...           — 미들웨어가 /seller/{tenant}/... 로 rewrite
 *   ② {링커slug}.zpzp.kr/seller/{tenant}/... — isSellerInternalPath 분기로 직접 렌더
 *
 * 링크를 항상 접두어 없는 `/{tenant}/...` 로 만들면 ②에서 스토어프론트 경로공간으로
 * 떨어져 `/{카탈로그tenant}/{slug}/...` 로 rewrite 되고 404 가 난다.
 * 지금 서 있는 경로공간을 따라가도록 접두어를 계산한다(①에서는 빈 문자열 = 기존 동작).
 */
export function sellerBasePrefix(pathname: string | null | undefined) {
    const p = pathname ?? "";
    return p === "/seller" || p.startsWith("/seller/") ? "/seller" : "";
}

export function getSellerHref(tenant: string, path = "", basePrefix = "") {
    const normalized = !path
        ? ""
        : path.startsWith("/")
            ? path
            : `/${path}`;

    return `${basePrefix}/${tenant}${normalized}`;
}

/** 클라이언트 컴포넌트용 — 현재 경로공간을 자동으로 반영하는 href 빌더. */
export function useSellerHref() {
    const basePrefix = sellerBasePrefix(usePathname());
    return (tenant: string, path = "") => getSellerHref(tenant, path, basePrefix);
}

/** 훅을 쓸 수 없는 위치(컴포넌트 밖 헬퍼 등)로 접두어만 넘길 때. */
export function useSellerBasePrefix() {
    return sellerBasePrefix(usePathname());
}
