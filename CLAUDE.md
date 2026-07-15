# CLAUDE.md — 줍줍(zpzp.kr) shop-next repo

> 이 repo(`zpzp-shop-next`)는 **줍줍 스토어프론트(Next.js) + `apps/api`(Fastify+Prisma) API** 입니다.
> 본사 관리자 + 구 쇼핑몰(레거시 PHP)은 별도 repo **`zpzp-shop-php`** 입니다.
> 줍줍은 디스카운트 올데이(DAD)를 복제한 커스텀 포크로, 코드는 유사하나 서버/DB/운영은 별개입니다.

---

## 0. 작업 규칙

- 한국어로 응답
- 파일 수정 시 항상 파일 경로를 먼저 명시
- 불확실하면 추정하지 말고 [불확실] 태그 또는 질문
- 일반 작업은 바로 진행, 비가역적 운영 변경(서버/DB)만 확인 받고 진행
- DB 쿼리·마이그레이션은 영향 범위를 먼저 설명
- 공용 설정 파일(env, 빌드 설정 등)의 삭제/이동/이름변경은 실행 전 반드시 보고 후 승인
- 주민등록번호 등 민감정보는 평문 저장 금지 — 암호화 저장 필수
- 시크릿 값은 코드/문서/커밋에 절대 포함 금지 (.env.example 방식 유지)

## 0-1. 확정 정책 요약 (2026-07-11 기준 — 모든 작업의 전제)

- URL: 아이디.zpzp.kr 서브도메인 (경로 기반 아님)
- 회원 흐름: 본사 일반회원 가입(카카오, 닉네임·휴대폰 필수) → 링커 전환 신청
  (샵이름/SNS URL 1개+/실명/연락처/약관 — 계좌·주민번호는 이 단계에서 받지 않음)
  → 관리자 승인 → 링커 URL·기본 등급/슬롯 생성
- 미가입자가 셀러 서브도메인에서 카카오 로그인 → 계정 자동 생성 금지, 본사 가입으로 유도
- 구매확정: 고객 직접 + 배송완료 D+7 자동 병행. 교환/반품/취소 진행 중 타이머 정지,
  절차 종료 후 잔여일 재계산. confirmed_at(확정 시각) + 확정 방식 저장 필수
  — 크루 카운트·등급 집계(마감선: 전월 말일 24시)의 기준 데이터
- 크루: 링커 링크로 가입 + 첫 주문 구매확정 완료 시 1명 인정.
  최초 유입 링커 1명에게 평생 단일 귀속 (중복 귀속 없음)
- 수수료 = 실결제금액(판매가 - 쿠폰 - 웰컴머니 등 전체 할인) × 등급별 수수료율(5~8%).
  상품별 수수료/공급가 반영은 2차. 검증 예: 20,000-3,000-3,000=14,000×5%=700원
- 주문 시점 스냅샷 저장: 판매가/할인 내역/실결제액/당시 등급/적용 수수료율/수수료액
  — 이후 등급·수수료 변경이 과거 정산에 영향 없어야 함
- 정산: 구매확정 시 출금가능 전환 / 최소 신청 10,000원 / 전액 신청만(부분은 2차) /
  개인 3.3% 원천징수, 사업자 세금계산서 / 지급 매월 15일, 휴일이면 직전 영업일 /
  지급 주기는 환경설정 값 (기본 월 1회/15일, 주 단위 전환 가능 구조) /
  대기 상태만 링커 취소 가능, 반려 시 사유 필수 + 금액 출금가능 복귀, 지급완료 건 재신청 불가
- 첫 출금 폼: 사업자 유형 4종 동적 필수 — 개인(주민번호, 암호화)/개인사업자(사업자번호+상호)/
  법인(법인등록번호+상호)/외국인(1차는 '별도 안내 예정' 처리). 공통: 예금주·은행·계좌
- 취소/환불: 당월 구매확정 반영 + 익월 취소분 차감, 차감액이 잔액 초과 시 음수 이월
- 웰컴머니: 쿠폰 방식(적립금 원장 아님). 1인 1회 / 유효 30일 / 최소주문 10,000원 /
  취소 시 미사용 복원 / 지급액·중복사용은 환경설정 값
- 비회원 가격: 비회원에게 정가·할인율은 노출 가능, 실판매가만 서버사이드 미전송+마스킹
  (masked 플래그). 프론트 CSS 가리기 금지
- 등급(팀장 파트): 6단계, 크루 기준·슬롯·수수료율(5~8%)은 환경설정 값 — 정산은 주문 시점
  등급·요율 스냅샷만 저장하므로 등급 체계 변경에 무관하게 동작. 매월 5일 반영(마감 전월 말일 24시),
  이력 저장 + 관리자 조회 화면 모두 1차
- 환경설정류(정산 설정·웰컴머니 설정): 화면 없이 테이블 + 초기값 seed만, 관리 화면은 오픈 후
- 1차 공통: 반응형 모바일 우선

## 0-2. 담당 경계

- 승우(나): 셀러 회원/로그인, 링커 전환, 정산 전체, 가격 마스킹, 웰컴머니
- 팀장/이상목: 본사 상품, 링커 등급, 등급별 슬롯
  — 이 영역의 코드/테이블 변경 제안 금지, 필요 시 "인터페이스 확인 필요"로 분리 보고
- 파트 간 인터페이스: confirmed_at(구매확정 시각)과 크루 귀속 데이터를 등급 배치가 읽어감
  → 관련 테이블 구조 확정/변경 시 즉시 사용자에게 알려 팀 공유하게 할 것
- 전체 로드맵: docs/ZPZP_개발마스터_v2.md 참고

---

## 1. repo 구조 (실측)

| 구성 | 내용 |
|------|------|
| 루트 | **Next.js 16.1.6** (App Router `src/app`, React 19). 패키지매니저 **npm**(`package-lock.json`). 프론트 `:3000` |
| `apps/api` | **Fastify 4**(`@dad/api`) + **Prisma 6** + tsx. API `:4000`. 진입 `src/server.ts`(`import "dotenv/config"`, `PORT ?? 4000`) |

**앱 라우팅 그룹 (`src/app`)**
- `(site)/[tenant]/...` — 스토어프론트 (홈 / 상품 / 장바구니 / 내 정보 설정)
- `(seller)/seller/[tenant]/...` — 셀러 백오피스 (대시보드 / 주문 / 매출 / 회원 / 가입승인 / 지점관리 / 상품)
- `(admin)`, `(admin-auth)` — 어드민 (별도 User 모델 + bcrypt 로그인)
- `auth/kakao/{login,callback}` — 카카오 OAuth (HMAC 서명 state, `AUTH_STATE_SECRET`)
- `api/...` — Next 라우트 핸들러 (프록시 → `apps/api`, `API_BASE_URL`)

**apps/api 모듈 (`src/modules`)**
- `public/` — auth(kakao/complete·session·logout), products, orders, tenants, member
- `admin/` — auth, dashboard, orders, products, uploads …
- `seller/` — dashboard, orders, sales, members, applications, tenants, access-check, global
- `health/` — `GET /health`

**테넌트 처리 위치**
- `src/middleware.ts` — 서브도메인 `아이디.zpzp.kr` → 내부 `/[tenant]` 경로로 rewrite. `getSubdomain`(3-파트에서 첫 라벨), `RESERVED_SUBDOMAINS`=www/admin/auth/api/select-tenant/seller. 시스템 호스트는 `역할.baseDomain`으로 판별. `LOCAL_BYPASS_AUTH`는 미들웨어만 우회(API access-check는 실제 세션 필요).
- `apps/api/src/plugins/tenant.ts` — preValidation 훅에서 `x-tenant-slug` 헤더 우선, 없으면 host로 테넌트 해석. ⚠️ 서비스 호스트(`auth.discountallday.kr`, `select-tenant.discountallday.kr`)가 **코드에 하드코딩** → ZPZP 전환 시 함께 수정 필요.

**인증/역할**
- 스토어프론트/셀러 로그인 = **카카오 전용**(`mallRN_member` + `mallRN_member_social_account`). 아이디/비번 로그인 경로 없음.
- 역할(`mallRN_member_membership`): `seller_owner`/`seller_staff`(매장 스코프), `hq_super`(global 스코프 = 본사 전체권한). 승인 = 멤버십 `status=active`.

**Prisma**: `apps/api/prisma/schema.prisma`(provider `mysql`, `env("DATABASE_URL")`), `prisma/seed.ts`. **마이그레이션이 아니라 introspect(`db pull`)** 방식.

---

## 2. env 파일 구성

- 프론트: `.env.local`(dev 최우선 로드), `.env.production`(prod 빌드). API: `apps/api/.env`.
- 템플릿: **`.env.example`, `apps/api/.env.example`** — 시크릿은 빈 값(`→ 팀 요청`), 비시크릿 로컬 기본값(`zpzp.local` 등)은 채워둠. fresh clone 시 복사해서 사용.
- ⚠️ **현재 env 도메인 값이 전부 `discountallday.kr`(옛 서비스)** → ZPZP(`zpzp.kr` / 로컬 `zpzp.local`)로 전환 필요(세션 A). `AUTH_ORIGIN`/`COOKIE_DOMAIN`/`TENANT_BASE_DOMAIN`/`SITE_ORIGIN`/`SELECT_TENANT_ORIGIN` 등은 **접속 호스트와 한 세트로** 바꿔야 함(하나만 바꾸면 로그인 루프).
- ⚠️ **시크릿 env는 추적 해제 준비 완료(푸시 대기)**. `.env.local`/`.env.production`/`apps/api/.env`는 gitignore 예정, 값은 개별 전달. 공용 설정 파일 삭제/이동은 §0 규칙대로 보고 후 진행.

---

## 3. DB 연결 현황 (실측 2026-07-11)

- `apps/api/.env`의 `DATABASE_URL = mysql://admin:***@49.247.170.220:33002/b2bdb` (커밋본 = 서버 실제값 동일).
- **실측 결과**: 이 연결은 실제로 **ZPZP 서버(hostname `dshub1020-305307`)의 MySQL, `@@port=3306`** 에 도달합니다. 조회 시 ZPZP 실테넌트(`ilsan-janghang / daegu-suseong / funcher / busan-sujeong / test-seller`)가 보이며, **shop-php가 쓰는 `localhost:3306/b2bdb`와 동일한 DB** 입니다.
- 포트 정리:
  - `49.247.170.220:33002` = 외부 표기 주소이나 실제로는 **ZPZP 서버의 3306으로 포워딩되어 동작** (원격 33002 TCP 연결 OK).
  - **ZPZP 서버 로컬에서 33002는 listen 하지 않음** (로컬 listen은 3306, 4000, 3000, 33060/mysqlx).
- 결론: shop-php(`localhost:3306`)와 shop-next(`49.247.170.220:33002`)는 **같은 b2bdb** 를 사용. IP가 DAD 서버 IP(`49.247.170.220`)로 보여 오해 소지가 있으나 **데이터는 ZPZP** 이며 정상 동작. (표기를 ZPZP 기준으로 정리하는 것을 권장.)

---

## 4. 마스터 문서

- **`docs/ZPZP_개발마스터_v2.md`** (⚠️ 위치: `zpzp-shop-php` repo의 `docs/`) — 오픈(7월 말)까지 남은 작업·실행 순서·확정 정책·타 파트 인터페이스를 담은 **프로젝트 마스터 로드맵**. 우선순위/일정 확인용.

---

## 참고: 이 repo의 `*.md` gitignore

- `.gitignore`에 `*.md`("markdown — 로컬에서만 관리")가 있어 **이 CLAUDE.md도 기본은 git 미추적(로컬 전용)** 입니다.
- 저장소에 커밋하려면 `.gitignore`에 `!CLAUDE.md` 예외를 추가해야 합니다.
