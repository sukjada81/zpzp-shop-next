# 셀러 콘솔 지점(매장) 관리 UI — 설계 문서

작성일: 2026-06-02
대상 시스템: store-franchise (Next.js + Fastify/Prisma)

## 1. 목적

셀러 콘솔(`seller.discountallday.kr`)에 **지점(tenant) 추가·수정·비활성화 UI**를 추가한다. 최고권한자(`hq_super` 역할 보유자)만 사용 가능. 본사 별도 admin 도메인을 거치지 않고 셀러 콘솔 안에서 지점 운영을 끝낼 수 있게 한다.

## 2. 의사결정 요약

브레인스토밍을 통해 확정된 핵심 결정:

| 항목 | 결정 |
|---|---|
| 삭제 의미 | **Soft delete** — `status='inactive'`로 전환. 하드 삭제 없음 |
| UI 구조 | 사이드바 메뉴 + 목록 페이지 + 상세 페이지 |
| 폼 노출 필드 | **5개**: slug, 이름, 상태, 도메인(`primaryDomain`), 오픈채팅 URL |
| 숨김 필드 | `timezone`(서버측 `Asia/Seoul` 고정), `themeJson`(원본 편집 불가 — `openchatUrl`만 키로 머지) |
| slug 편집성 | **생성 시만 입력**, 수정 불가 (URL/북마크 안정성) |
| 접근 가드 | 2중: Next 레이아웃의 `__all__` super-check + API 측 `requireHqSuper` |
| 별도 DELETE 엔드포인트 | **없음** — PUT으로 `status='inactive'` |

## 3. 아키텍처

### 3.1 URL 구조

```
seller.discountallday.kr/__all__/tenants          ← 목록
seller.discountallday.kr/__all__/tenants/new      ← 신규 등록
seller.discountallday.kr/__all__/tenants/{id}     ← 상세/수정
```

`__all__` 경로는 이미 `src/app/(seller)/seller/[tenant]/layout.tsx` 가 hq_super 만 통과시키는 super-check를 수행한다 (line 89-103). 신규 가드 코드 작성 불필요.

### 3.2 데이터 모델

기존 `tenant` Prisma 모델 그대로 사용. 스키마 변경 없음.

사용 컬럼:
- `id` BigInt (PK, auto-increment)
- `slug` String (unique, 생성 후 immutable)
- `name` String
- `status` String — `active` | `inactive` | `draft`
- `primaryDomain` String? — unique when set
- `timezone` String — 서버측 `"Asia/Seoul"` 고정
- `themeJson` String? (JSON) — `openchatUrl` 만 키로 저장/조회

### 3.3 인증·인가

| 작업 | 가드 |
|---|---|
| Next 레이어 (페이지 진입) | 부모 layout 의 `__all__` super-check → 비-hq_super면 `SellerNoAccess` |
| API GET (목록·상세) | `hq_admin` / `hq_staff` / `hq_super` (기존 GET 그대로) |
| API POST·PUT | **`hq_super` 전용** (`requireHqSuper` 헬퍼) |

## 4. API 엔드포인트

확장 대상: `apps/api/src/modules/seller/tenants.routes.ts`

### 4.1 GET `/v1/seller/tenants`

기존 엔드포인트 확장. 응답 필드 추가 + status 필터 지원.

쿼리스트링: `?status=active|inactive|draft|all` — 기본값 `active` (기존 호출자 호환 유지). 관리 UI는 `?status=all`.

응답:
```ts
{ ok: true, items: [{
    id: number,
    slug: string,
    name: string,
    status: "active" | "inactive" | "draft",
    primaryDomain: string | null,
    openchatUrl: string | null
}] }
```

`openchatUrl` 은 `themeJson` 파싱 후 추출.

### 4.2 GET `/v1/seller/tenants/:id` (신규)

응답:
```ts
{ ok: true, tenant: {
    id, slug, name, status, primaryDomain, timezone, openchatUrl
}}
```

404 시: `{ ok: false, message: "TENANT_NOT_FOUND" }`

### 4.3 POST `/v1/seller/tenants` (신규)

요청 본문:
```ts
{
    slug: string,           // 필수
    name: string,           // 필수
    status?: string,        // 기본 "active"
    primaryDomain?: string,
    openchatUrl?: string
}
```

서버 처리:
1. `requireHqSuper` 통과
2. `slug`, `name` 필수 검증 → 400
3. `status` 가 active/inactive/draft 외이면 → 400
4. `slug` 중복 검사 (`tenant.findFirst({where:{slug}})`) → 있으면 409 `SLUG_ALREADY_EXISTS`
5. `primaryDomain` 입력 시 중복 검사 → 409 `PRIMARY_DOMAIN_ALREADY_EXISTS`
6. `themeJson = openchatUrl ? JSON.stringify({openchatUrl}) : null`
7. `tenant.create({ data: { slug, name, status, primaryDomain || null, timezone: "Asia/Seoul", themeJson } })`

응답: `{ ok: true, tenant: {...} }`

### 4.4 PUT `/v1/seller/tenants/:id` (신규)

요청 본문 (모두 선택):
```ts
{
    name?: string,
    status?: string,
    primaryDomain?: string,
    openchatUrl?: string
}
```

요청에 `slug` 가 포함돼도 무시 (immutable).

서버 처리:
1. `requireHqSuper` 통과
2. 대상 tenant 조회 → 없으면 404
3. `name` 빈 문자열로 변경 시도 → 400
4. `status` 가 active/inactive/draft 외이면 → 400
5. `primaryDomain` 변경 시 다른 행 unique 검사 (자기 id 제외) → 409
6. `themeJson` 머지: 기존 themeJson 파싱 → `{...existing, openchatUrl}` 로 갱신. `openchatUrl === ""` 면 키 제거.
7. `tenant.update`

응답: `{ ok: true, tenant: {...} }`

### 4.5 `requireHqSuper` 헬퍼

`apps/api/src/modules/seller/tenants.routes.ts` 안에 정의:

```ts
async function requireHqSuper(app, req, reply): Promise<boolean> {
    const member = req.session?.member;
    if (!member?.uid) {
        reply.code(401).send({ ok: false, message: "login required" });
        return false;
    }
    const ms = await app.prisma.mallRN_member_membership.findFirst({
        where: {
            member_uid: Number(member.uid),
            status: "active",
            scope_type: "global",
            role_code: "hq_super",
        },
    });
    if (!ms) {
        reply.code(403).send({ ok: false, message: "super admin required" });
        return false;
    }
    return true;
}
```

(`applications.routes.ts` 의 `requireSuperAdmin` 과 동일 로직)

## 5. 컴포넌트 / 페이지 구조

### 5.1 Next.js 페이지 (서버 컴포넌트)

```
src/app/(seller)/seller/[tenant]/tenants/
├── page.tsx              ← 목록 (params.tenant === "__all__" 기대)
├── new/page.tsx          ← 신규 등록
└── [id]/page.tsx         ← 상세/수정
```

각 페이지는:
- **`page.tsx`**: `fetch("/api/proxy/v1/seller/tenants?status=all", { cache: "no-store", credentials: "include" })` → `<SellerTenantsListClient items={items} />`
- **`new/page.tsx`**: 빈 값으로 `<SellerTenantFormClient mode="new" />`
- **`[id]/page.tsx`**: `fetch("/api/proxy/v1/seller/tenants/{id}")` → 못 찾으면 `notFound()` → `<SellerTenantFormClient mode="edit" tenant={...} />`

### 5.2 클라이언트 컴포넌트

**`src/components/seller/SellerTenantsListClient.tsx`**
- 테이블 컬럼: 이름 / slug / 상태(배지) / 도메인 / 액션
- 상태 배지 색상: `active`=초록, `inactive`=회색, `draft`=노랑
- 상단 우측: "+ 신규 지점" 버튼 (`/__all__/tenants/new`)
- 행 클릭: `/__all__/tenants/{id}`
- 빈 목록 / 에러 상태 빈 영역 처리

**`src/components/seller/SellerTenantFormClient.tsx` (생성·수정 공용)**
- Props: `{ mode: "new" | "edit", tenant?: TenantDto }`
- 필드: slug (edit 모드면 readonly), 이름, 상태(드롭다운), 도메인, 오픈채팅 URL
- 제출:
  - `mode="new"`: POST `/api/proxy/v1/seller/tenants` → 성공 시 `router.push("/__all__/tenants")` + `router.refresh()`
  - `mode="edit"`: PUT `/api/proxy/v1/seller/tenants/{id}` → 동일하게 목록 복귀
- 수정 모드 보조 버튼: **"이 지점 비활성화"** (status≠inactive 일 때만 표시, 빨강 outline)
  - 클릭 → `window.confirm` → PUT `{status:"inactive"}` → 목록 복귀

### 5.3 사이드바 메뉴 추가

`src/components/seller/SellerShell.tsx` 수정:
- `isSuperAdmin === true` 일 때 새 메뉴 항목 노출
- 라벨: **"지점 관리"**, 아이콘: `Building2` (lucide-react)
- href: 항상 `/__all__/tenants` (어느 테넌트에서 클릭하든 글로벌 페이지로 이동)
- 메뉴 위치: 기존 hq_super 전용 항목들(예: 전체 지점 대시보드·승인 관리) 근처

## 6. 데이터 흐름

### 6.1 목록
```
브라우저 → /__all__/tenants
  ↓ layout super-check (hq_super 확인)
  ↓ page.tsx 서버 fetch /api/proxy/v1/seller/tenants?status=all
    ↓ Next 프록시 → Fastify GET
    ↓ Prisma tenant.findMany({orderBy: id asc})
    ↓ themeJson 파싱 → openchatUrl 추출
  ↓ items 배열을 SellerTenantsListClient prop 전달
  ↓ 클라이언트 렌더링
```

### 6.2 신규 등록
```
폼 submit → POST /api/proxy/v1/seller/tenants
  ↓ Fastify POST
    ├ requireHqSuper
    ├ slug/name/status 검증
    ├ slug 중복 검사
    ├ primaryDomain 중복 검사
    ├ themeJson = openchatUrl ? JSON.stringify({openchatUrl}) : null
    └ tenant.create({timezone:"Asia/Seoul", ...})
  ↓ 200 응답
  ↓ router.push("/__all__/tenants") + router.refresh()
```

### 6.3 수정
```
[id]/page.tsx 서버 fetch GET 상세 → SellerTenantFormClient 초기값
폼 submit → PUT /api/proxy/v1/seller/tenants/{id}
  ↓ Fastify PUT
    ├ requireHqSuper
    ├ 대상 조회 → 없으면 404
    ├ primaryDomain 변경 시 unique 재검사 (자기 id 제외)
    ├ themeJson 머지: 기존 파싱 → {...existing, openchatUrl}
    └ tenant.update
  ↓ 200 응답 → router.push("/__all__/tenants") + router.refresh()
```

### 6.4 Soft delete
```
수정 화면 "비활성화" 클릭 → window.confirm
  ↓ PUT /api/proxy/v1/seller/tenants/{id} body={status:"inactive"}
  ↓ 동일 PUT 핸들러
  ↓ 200 → 토스트 "비활성화되었습니다" → 목록 복귀
  ↓ 목록은 ?status=all 이라 inactive 도 회색 배지로 보임 (되살리려면 상태 드롭다운에서 active 로)
```

### 6.5 캐시 / 일관성
- 모든 server fetch: `cache: "no-store"`
- 액션 후 `router.refresh()` 로 서버 컴포넌트 재페치 → 목록 즉시 갱신
- 테넌트 스위처(SellerShell)는 자체 useEffect 가 active 목록 조회 → 다음 페이지 이동/포커스 시 새 지점 반영. 별도 broadcast 불필요.

## 7. 에러 처리

### 7.1 API 응답 코드/메시지 매핑

| 상황 | HTTP | code/message | UI 한국어 |
|---|---|---|---|
| 미로그인 | 401 | `login required` | "로그인이 필요합니다" (안전망) |
| hq_super 아님 (쓰기) | 403 | `super admin required` | "최고권한자만 변경할 수 있습니다" |
| slug 누락 | 400 | `SLUG_REQUIRED` | "slug는 필수입니다" |
| name 누락 | 400 | `NAME_REQUIRED` | "이름은 필수입니다" |
| 잘못된 status | 400 | `INVALID_STATUS` | "상태값이 올바르지 않습니다" |
| slug 중복 | 409 | `SLUG_ALREADY_EXISTS` | "이미 사용 중인 slug 입니다" |
| 도메인 중복 | 409 | `PRIMARY_DOMAIN_ALREADY_EXISTS` | "이미 사용 중인 도메인입니다" |
| 대상 없음 | 404 | `TENANT_NOT_FOUND` | "지점을 찾을 수 없습니다" |
| 기타 서버 오류 | 500 | — | "저장 중 오류가 발생했습니다" |

### 7.2 프론트엔드 처리

- 제출 중: 버튼 disabled + 스피너
- 비-2xx 응답: `message` 코드를 한국어 매핑으로 변환 → 폼 상단 빨강 박스에 표시
- 네트워크 오류 catch: "네트워크 오류 — 잠시 후 다시 시도해 주세요"
- 클라이언트 사전 검증: slug/이름 빈값 → API 호출 전 차단
- 목록 페이지: 서버 fetch 실패 시 빈 배열 + 상단 경고 박스 + 재시도 버튼 (router.refresh)
- Soft delete 확인: 단순 `window.confirm` (reversible 작업이라 과한 보호 불필요)

## 8. 테스트 전략

자동 unit 테스트보다 **수동 시나리오 + API 가드 최소 검증**으로 진행. 프로젝트에 아직 E2E 인프라가 없고 이 기능 규모상 도입 정당화 어려움.

### 8.1 자동 (최소)

- API typecheck: `cd apps/api && npx tsc -p tsconfig.json --noEmit` 통과
- Next typecheck: `npx tsc --noEmit` 통과
- API/Next 빌드: `npm run build` 둘 다 성공
- API 가드 cURL 테스트: hq_admin 세션으로 POST/PUT 시도 → 403 응답 확인

### 8.2 수동 시나리오 체크리스트 (배포 전 1회 점검)

- [ ] 일반 셀러(seller_owner) 로 `/__all__/tenants` 접근 → `SellerNoAccess` 차단
- [ ] hq_super 로 진입 → 4개 활성 지점 + 숨김 지점(`?status=all`) 모두 목록 표시
- [ ] 새 지점 등록 → 목록·테넌트 스위처 즉시 반영
- [ ] 중복 slug 시도 → 409 메시지 정상 표시
- [ ] 중복 도메인 시도 → 409 메시지 정상 표시
- [ ] 기존 지점 수정 (이름·도메인·오픈채팅URL) → 저장 후 재진입 시 값 유지
- [ ] 수정 화면 slug 필드 readonly 확인
- [ ] "비활성화" 버튼 → confirm → status=inactive → 목록에 회색 배지 → `{slug}.discountallday.kr` 접근 차단되는지
- [ ] inactive → active 로 다시 변경하면 사이트 살아나는지

## 9. 범위 제외 (out of scope)

다음은 이번 구현에서 다루지 않음:
- **하드 삭제** (DB row 제거)
- **themeJson 의 openchatUrl 외 키** 편집 UI (brandColor 등은 admin 도메인 폼에서 계속 관리)
- **timezone 변경** (Asia/Seoul 고정)
- **지점 일괄 가져오기/내보내기** (CSV 등)
- **변경 이력 / 감사 로그** (누가 언제 무엇을 바꿨는지 별도 추적)
- **E2E 자동화 테스트** 인프라 도입

## 10. 배포 노트

- API 변경 포함 → 서버에서 `cd apps/api && npm run build && pm2 restart discountallday-api`
- Next 변경 포함 → `npm run build && pm2 restart shop-next`
- 스키마 변경 없음 → DB 마이그레이션 불필요
- 권한 데이터 변경 없음 — 기존 `hq_super` 멤버 그대로 사용

## 11. 변경 파일 목록 (구현 시)

신규:
- `src/app/(seller)/seller/[tenant]/tenants/page.tsx`
- `src/app/(seller)/seller/[tenant]/tenants/new/page.tsx`
- `src/app/(seller)/seller/[tenant]/tenants/[id]/page.tsx`
- `src/components/seller/SellerTenantsListClient.tsx`
- `src/components/seller/SellerTenantFormClient.tsx`

수정:
- `apps/api/src/modules/seller/tenants.routes.ts` (GET 확장 + POST/PUT/GET:id 추가 + requireHqSuper 헬퍼)
- `src/components/seller/SellerShell.tsx` (사이드바 메뉴 항목 + 아이콘 추가)

DB·환경변수 변경: 없음.
