# shop-seller-01 (Frontend)

Next.js(App Router) + Tailwind 기반의 모바일 우선 프론트엔드입니다.  
백엔드는 기존 더도매 PHP 원소스(관리자 포함)를 유지하며, 이 프론트는 **BFF(얇은 인터페이스)** 형태로 PHP API와 연동합니다.

---

## 1) 프로젝트 개요

- Frontend: Next.js(App Router) + TailwindCSS
- Backend: 기존 더도매 PHP(원사이트 관리자 수정 없이 유지)
- Tenant: 현재는 Path 기반 `/{tenant}` → 운영 시 서브도메인 Host 기반 확장 고려
- 목표: 고객/셀러 화면(모바일 우선)을 Next.js로 제공, 데이터/주문/회원은 PHP에서 처리

---

## 2) 라우팅 구조 (요약)

- 고객/공구 영역: `src/app/(site)/[tenant]/(app)/...`
  - `/[tenant]/home`
  - `/[tenant]/goods`
  - `/[tenant]/goods/[id]`
  - `/[tenant]/cart`
  - `/[tenant]/order`
  - `/[tenant]/orders`
- 로그인(간단 화면): `src/app/(site)/[tenant]/(auth)/login`

> 공통 헤더/사이드드로어는 `(app)/layout.tsx -> AppShellClient`에서 적용됩니다.

---

## 3) PHP 연동 방식 (BFF / Proxy)

### 핵심 원칙
1) 브라우저(프론트)는 PHP 원본 도메인을 직접 호출하지 않습니다.  
2) Next.js 쪽에서 `/api/_proxy/*` 라우트를 통해 PHP로 요청을 프록시합니다.  
3) 인증은 `HttpOnly Cookie` 기반 세션/토큰으로 처리하는 것을 권장합니다.

### Proxy 엔드포인트 (Next.js)
- `src/app/api/_proxy/route.ts`
- 프론트에서는 아래처럼 호출:
  - `fetch("/api/_proxy?path=/auth/kakao/start")`
  - `fetch("/api/_proxy?path=/goods/list&tenant=xxx")`

> 백엔드 개발자는 PHP에서 실제 API를 만들고, 프론트는 proxy를 통해 동일한 호출 패턴으로 붙입니다.

---

## 4) API 인터페이스 설계 가이드 (PHP)

### 4.1 공통 규칙 (권장)
- Base: `/api/v1`
- 응답 포맷 통일:
```json
{
  "ok": true,
  "data": {},
  "error": null
}
