# 셀러 콘솔 지점(매장) 관리 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 셀러 콘솔(`seller.discountallday.kr`) 내부에 hq_super 전용 지점(tenant) 추가·수정·비활성화 UI를 만든다. 본사 admin 도메인을 거치지 않고 지점 운영을 끝낼 수 있게 한다.

**Architecture:** 기존 `/__all__` 경로의 super-check 레이아웃 가드를 그대로 활용. 신규 페이지 3개(`tenants/page.tsx`, `tenants/new/page.tsx`, `tenants/[id]/page.tsx`), 공용 클라이언트 컴포넌트 2개(`SellerTenantsListClient`, `SellerTenantFormClient`), 기존 `seller/tenants.routes.ts`에 GET 확장 + GET/:id + POST + PUT 추가. 삭제는 별도 엔드포인트 없이 PUT `status='inactive'`로 처리.

**Tech Stack:** Next.js 16 App Router (server + client components), Fastify + Prisma, lucide-react 아이콘, TailwindCSS, MariaDB.

**Spec reference:** `docs/superpowers/specs/2026-06-02-seller-tenant-admin-ui-design.md`

---

## 파일 구조

신규 파일:
- `src/app/(seller)/seller/[tenant]/tenants/page.tsx` — 목록 페이지 (서버)
- `src/app/(seller)/seller/[tenant]/tenants/new/page.tsx` — 신규 페이지 (서버)
- `src/app/(seller)/seller/[tenant]/tenants/[id]/page.tsx` — 수정 페이지 (서버)
- `src/components/seller/SellerTenantsListClient.tsx` — 목록 클라이언트
- `src/components/seller/SellerTenantFormClient.tsx` — 생성·수정 공용 폼 클라이언트

수정 파일:
- `apps/api/src/modules/seller/tenants.routes.ts` — GET 확장 + `requireHqSuper` 헬퍼 + GET:id/POST/PUT 추가
- `src/components/seller/SellerShell.tsx` — 사이드바 "지점 관리" 메뉴 항목 추가

---

## Task 1: API 헬퍼 추가 + GET 목록 확장

**Files:**
- Modify: `apps/api/src/modules/seller/tenants.routes.ts`

이 태스크는 기존 파일을 완전히 교체한다. 기존 GET 의 권한 체크는 그대로 두고, 응답 필드 확장(status/primaryDomain/openchatUrl) + `?status` 필터 + 추후 태스크에서 쓸 헬퍼 3개(`requireHqSuper`, `parseOpenchatUrl`, `mergeOpenchatUrl`) 추가.

- [ ] **Step 1: `apps/api/src/modules/seller/tenants.routes.ts` 의 전체 내용을 다음으로 교체**

```ts
// apps/api/src/modules/seller/tenants.routes.ts
import type { FastifyInstance } from "fastify";

const GLOBAL_ADMIN_ROLES = ["hq_admin", "hq_staff", "hq_super"] as const;

type MemberSession = {
    uid?: string | number;
};

function getSessionMember(req: any): MemberSession | null {
    const member = req.session?.member as MemberSession | undefined;
    if (!member?.uid) return null;
    return member;
}

function toInt(v: unknown, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

// themeJson 에서 openchatUrl 만 추출해 응답에 노출
function parseOpenchatUrl(themeJson: string | null | undefined): string | null {
    if (!themeJson) return null;
    try {
        const parsed = JSON.parse(themeJson);
        const v = parsed?.openchatUrl;
        return typeof v === "string" && v ? v : null;
    } catch {
        return null;
    }
}

// 기존 themeJson 을 파싱해 openchatUrl 키만 교체한 새 JSON 문자열(없으면 null) 반환.
// openchatUrl === undefined 이면 기존 그대로 유지.
function mergeOpenchatUrl(
    themeJson: string | null | undefined,
    openchatUrl: string | undefined
): string | null {
    let existing: Record<string, any> = {};
    if (themeJson) {
        try {
            existing = JSON.parse(themeJson) ?? {};
        } catch {
            existing = {};
        }
    }
    if (openchatUrl === undefined) {
        return Object.keys(existing).length ? JSON.stringify(existing) : null;
    }
    const v = String(openchatUrl).trim();
    if (v) existing.openchatUrl = v;
    else delete existing.openchatUrl;
    return Object.keys(existing).length ? JSON.stringify(existing) : null;
}

// hq_super 전용 가드 — 쓰기 엔드포인트에서 사용
async function requireHqSuper(
    app: FastifyInstance,
    req: any,
    reply: any
): Promise<boolean> {
    const member = getSessionMember(req);
    if (!member?.uid) {
        reply.code(401).send({ ok: false, message: "login required" });
        return false;
    }
    const memberUid = toInt(member.uid, 0);
    if (memberUid <= 0) {
        reply.code(401).send({ ok: false, message: "invalid session" });
        return false;
    }
    const ms = await app.prisma.mallRN_member_membership.findFirst({
        where: {
            member_uid: memberUid,
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

export async function sellerTenantsRoutes(app: FastifyInstance) {
    // GET 목록 — hq_admin / hq_staff / hq_super
    // 쿼리: ?status=active|inactive|draft|all (기본 active — 기존 테넌트 스위처 호환)
    app.get("/v1/seller/tenants", async (req: any, reply) => {
        const member = getSessionMember(req);
        if (!member?.uid) {
            return reply.code(401).send({ ok: false, message: "login required" });
        }

        const memberUid = toInt(member.uid, 0);
        if (memberUid <= 0) {
            return reply.code(401).send({ ok: false, message: "invalid session" });
        }

        const globalMs = await app.prisma.mallRN_member_membership.findFirst({
            where: {
                member_uid: memberUid,
                status: "active",
                scope_type: "global",
                role_code: { in: [...GLOBAL_ADMIN_ROLES] },
            },
            select: { role_code: true },
        });

        if (!globalMs) {
            return reply.code(403).send({ ok: false, message: "admin permission required" });
        }

        const rawStatus = String((req.query as any)?.status ?? "").trim();
        const validStatuses = ["active", "inactive", "draft", "all"];
        const statusFilter = validStatuses.includes(rawStatus) ? rawStatus : "active";

        const where: any = statusFilter === "all" ? {} : { status: statusFilter };

        const rows = await app.prisma.tenant.findMany({
            where,
            select: {
                id: true,
                slug: true,
                name: true,
                status: true,
                primaryDomain: true,
                themeJson: true,
            },
            orderBy: { id: "asc" },
        });

        return reply.send({
            ok: true,
            items: rows.map((t: any) => ({
                id: Number(t.id),
                slug: t.slug,
                name: t.name,
                status: t.status,
                primaryDomain: t.primaryDomain,
                openchatUrl: parseOpenchatUrl(t.themeJson),
            })),
        });
    });
}
```

- [ ] **Step 2: API typecheck 통과 확인**

Run: `cd "E:/dev/dev_elco/store-franchise/apps/api" && npx tsc -p tsconfig.json --noEmit 2>&1 | tail -5; echo "EXIT=$?"`
Expected: EXIT=0, no errors

- [ ] **Step 3: 커밋**

```bash
git -C "E:/dev/dev_elco/store-franchise" add apps/api/src/modules/seller/tenants.routes.ts
git -C "E:/dev/dev_elco/store-franchise" commit -m "feat(seller-api): extend tenants GET with status filter + openchatUrl; add hq_super helper"
```

---

## Task 2: GET /:id (지점 상세) 엔드포인트 추가

**Files:**
- Modify: `apps/api/src/modules/seller/tenants.routes.ts`

- [ ] **Step 1: `tenants.routes.ts` 의 `sellerTenantsRoutes` 함수 안, GET 목록 핸들러 바로 뒤에 다음 핸들러 추가**

(즉 `app.get("/v1/seller/tenants", ...)` 핸들러 닫는 `});` 다음 줄, 함수 닫는 `}` 직전에 삽입)

```ts
    // GET 상세 — hq_admin / hq_staff / hq_super
    app.get("/v1/seller/tenants/:id", async (req: any, reply) => {
        const member = getSessionMember(req);
        if (!member?.uid) {
            return reply.code(401).send({ ok: false, message: "login required" });
        }
        const memberUid = toInt(member.uid, 0);
        if (memberUid <= 0) {
            return reply.code(401).send({ ok: false, message: "invalid session" });
        }
        const globalMs = await app.prisma.mallRN_member_membership.findFirst({
            where: {
                member_uid: memberUid,
                status: "active",
                scope_type: "global",
                role_code: { in: [...GLOBAL_ADMIN_ROLES] },
            },
            select: { role_code: true },
        });
        if (!globalMs) {
            return reply.code(403).send({ ok: false, message: "admin permission required" });
        }

        const idRaw = String((req.params as any)?.id ?? "");
        if (!/^\d+$/.test(idRaw)) {
            return reply.code(400).send({ ok: false, message: "INVALID_ID" });
        }
        const id = BigInt(idRaw);

        const t = await app.prisma.tenant.findUnique({ where: { id } });
        if (!t) return reply.code(404).send({ ok: false, message: "TENANT_NOT_FOUND" });

        return reply.send({
            ok: true,
            tenant: {
                id: Number(t.id),
                slug: t.slug,
                name: t.name,
                status: t.status,
                primaryDomain: t.primaryDomain,
                timezone: t.timezone,
                openchatUrl: parseOpenchatUrl(t.themeJson),
            },
        });
    });
```

- [ ] **Step 2: API typecheck 통과 확인**

Run: `cd "E:/dev/dev_elco/store-franchise/apps/api" && npx tsc -p tsconfig.json --noEmit 2>&1 | tail -5; echo "EXIT=$?"`
Expected: EXIT=0

- [ ] **Step 3: 커밋**

```bash
git -C "E:/dev/dev_elco/store-franchise" add apps/api/src/modules/seller/tenants.routes.ts
git -C "E:/dev/dev_elco/store-franchise" commit -m "feat(seller-api): GET /v1/seller/tenants/:id detail endpoint"
```

---

## Task 3: POST (신규 지점 등록) 엔드포인트 추가

**Files:**
- Modify: `apps/api/src/modules/seller/tenants.routes.ts`

- [ ] **Step 1: Task 2 에서 추가한 GET :id 핸들러 바로 뒤에 다음 POST 핸들러 추가**

```ts
    // POST 신규 등록 — hq_super 전용
    app.post("/v1/seller/tenants", async (req: any, reply) => {
        if (!(await requireHqSuper(app, req, reply))) return;

        const body = (req.body ?? {}) as any;
        const slug = String(body.slug ?? "").trim();
        const name = String(body.name ?? "").trim();
        const rawStatus = String(body.status ?? "active").trim();
        const primaryDomain = String(body.primaryDomain ?? "").trim();
        const openchatUrl =
            body.openchatUrl !== undefined ? String(body.openchatUrl).trim() : undefined;

        if (!slug) return reply.code(400).send({ ok: false, message: "SLUG_REQUIRED" });
        if (!name) return reply.code(400).send({ ok: false, message: "NAME_REQUIRED" });

        const validStatuses = ["active", "inactive", "draft"];
        if (!validStatuses.includes(rawStatus)) {
            return reply.code(400).send({ ok: false, message: "INVALID_STATUS" });
        }

        const dupSlug = await app.prisma.tenant.findFirst({ where: { slug } });
        if (dupSlug) {
            return reply.code(409).send({ ok: false, message: "SLUG_ALREADY_EXISTS" });
        }

        if (primaryDomain) {
            const dupDomain = await app.prisma.tenant.findFirst({ where: { primaryDomain } });
            if (dupDomain) {
                return reply.code(409).send({ ok: false, message: "PRIMARY_DOMAIN_ALREADY_EXISTS" });
            }
        }

        const themeJson = mergeOpenchatUrl(null, openchatUrl);

        const created = await app.prisma.tenant.create({
            data: {
                slug,
                name,
                status: rawStatus,
                primaryDomain: primaryDomain || null,
                timezone: "Asia/Seoul",
                themeJson,
            },
        });

        return reply.send({
            ok: true,
            tenant: {
                id: Number(created.id),
                slug: created.slug,
                name: created.name,
                status: created.status,
                primaryDomain: created.primaryDomain,
                timezone: created.timezone,
                openchatUrl: parseOpenchatUrl(created.themeJson),
            },
        });
    });
```

- [ ] **Step 2: API typecheck 통과 확인**

Run: `cd "E:/dev/dev_elco/store-franchise/apps/api" && npx tsc -p tsconfig.json --noEmit 2>&1 | tail -5; echo "EXIT=$?"`
Expected: EXIT=0

- [ ] **Step 3: 커밋**

```bash
git -C "E:/dev/dev_elco/store-franchise" add apps/api/src/modules/seller/tenants.routes.ts
git -C "E:/dev/dev_elco/store-franchise" commit -m "feat(seller-api): POST /v1/seller/tenants create endpoint (hq_super)"
```

---

## Task 4: PUT (지점 수정, soft delete 포함) 엔드포인트 추가

**Files:**
- Modify: `apps/api/src/modules/seller/tenants.routes.ts`

- [ ] **Step 1: Task 3 에서 추가한 POST 핸들러 바로 뒤에 다음 PUT 핸들러 추가**

```ts
    // PUT 수정 — hq_super 전용. slug 변경 불가, status='inactive' = soft delete.
    app.put("/v1/seller/tenants/:id", async (req: any, reply) => {
        if (!(await requireHqSuper(app, req, reply))) return;

        const idRaw = String((req.params as any)?.id ?? "");
        if (!/^\d+$/.test(idRaw)) {
            return reply.code(400).send({ ok: false, message: "INVALID_ID" });
        }
        const id = BigInt(idRaw);

        const current = await app.prisma.tenant.findUnique({ where: { id } });
        if (!current) return reply.code(404).send({ ok: false, message: "TENANT_NOT_FOUND" });

        const body = (req.body ?? {}) as any;
        const data: any = {};

        if (body.name !== undefined) {
            const n = String(body.name).trim();
            if (!n) return reply.code(400).send({ ok: false, message: "NAME_REQUIRED" });
            data.name = n;
        }

        if (body.status !== undefined) {
            const s = String(body.status).trim();
            const validStatuses = ["active", "inactive", "draft"];
            if (!validStatuses.includes(s)) {
                return reply.code(400).send({ ok: false, message: "INVALID_STATUS" });
            }
            data.status = s;
        }

        if (body.primaryDomain !== undefined) {
            const d = String(body.primaryDomain).trim();
            if (d && d !== (current.primaryDomain ?? "")) {
                const dupDomain = await app.prisma.tenant.findFirst({
                    where: { primaryDomain: d, id: { not: id } },
                });
                if (dupDomain) {
                    return reply.code(409).send({ ok: false, message: "PRIMARY_DOMAIN_ALREADY_EXISTS" });
                }
            }
            data.primaryDomain = d || null;
        }

        if (body.openchatUrl !== undefined) {
            const openchatUrl = String(body.openchatUrl ?? "").trim();
            data.themeJson = mergeOpenchatUrl(current.themeJson ?? null, openchatUrl);
        }

        const updated = await app.prisma.tenant.update({ where: { id }, data });

        return reply.send({
            ok: true,
            tenant: {
                id: Number(updated.id),
                slug: updated.slug,
                name: updated.name,
                status: updated.status,
                primaryDomain: updated.primaryDomain,
                timezone: updated.timezone,
                openchatUrl: parseOpenchatUrl(updated.themeJson),
            },
        });
    });
```

- [ ] **Step 2: API typecheck 통과 확인**

Run: `cd "E:/dev/dev_elco/store-franchise/apps/api" && npx tsc -p tsconfig.json --noEmit 2>&1 | tail -5; echo "EXIT=$?"`
Expected: EXIT=0

- [ ] **Step 3: 커밋**

```bash
git -C "E:/dev/dev_elco/store-franchise" add apps/api/src/modules/seller/tenants.routes.ts
git -C "E:/dev/dev_elco/store-franchise" commit -m "feat(seller-api): PUT /v1/seller/tenants/:id update endpoint (hq_super, soft delete)"
```

---

## Task 5: API 가드 cURL 검증 (로컬 또는 운영 환경)

이 태스크는 **운영 또는 로컬에서 API 가 떠 있을 때**만 실행. API 빌드+재시작 후 한 번만 돌리면 된다. 가드만 검증하는 목적이므로 실패하면 즉시 코드 점검.

**Files:** (검증만, 변경 없음)

- [ ] **Step 1: API 재빌드 + 재시작 (서버 환경에서 실행)**

```bash
cd /var/www/shop-next/apps/api
npm run build
pm2 restart discountallday-api
```

Expected: pm2 표에서 `discountallday-api` 가 `online`, 메모리 80MB+ 정상.

- [ ] **Step 2: 미로그인 상태에서 POST 시도 → 401 확인**

```bash
curl -s -o /tmp/r.json -w "%{http_code}\n" -X POST http://localhost:4000/v1/seller/tenants \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: __all__" \
  -d '{"slug":"test_xx","name":"x"}'
cat /tmp/r.json; echo
```

Expected: HTTP 401, body `{"ok":false,"message":"login required"}`

- [ ] **Step 3: 잘못된 status 로 POST → 400 확인 (로그인 쿠키 사용)**

세션 쿠키가 필요. hq_super 계정으로 로그인된 브라우저에서 DevTools → Application → Cookies → `dad_admin_sid` 값을 복사해 아래 `SID` 치환.

```bash
SID="복사한_dad_admin_sid_값"
curl -s -o /tmp/r.json -w "%{http_code}\n" -X POST http://localhost:4000/v1/seller/tenants \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: __all__" \
  -H "cookie: dad_admin_sid=$SID" \
  -d '{"slug":"test_xx","name":"x","status":"bogus"}'
cat /tmp/r.json; echo
```

Expected: HTTP 400, body `{"ok":false,"message":"INVALID_STATUS"}`

- [ ] **Step 4: 검증 완료. (이 태스크는 커밋 없음 — 검증만)**

만약 응답이 다르다면 Task 1~4 의 코드를 다시 점검할 것.

---

## Task 6: SellerTenantFormClient (생성·수정 공용 폼 클라이언트)

**Files:**
- Create: `src/components/seller/SellerTenantFormClient.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
// src/components/seller/SellerTenantFormClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TenantDto = {
    id: number;
    slug: string;
    name: string;
    status: "active" | "inactive" | "draft" | string;
    primaryDomain: string | null;
    timezone?: string;
    openchatUrl: string | null;
};

const ERROR_MAP: Record<string, string> = {
    "login required": "로그인이 필요합니다.",
    "invalid session": "세션이 만료되었습니다. 다시 로그인해 주세요.",
    "super admin required": "최고권한자만 변경할 수 있습니다.",
    "admin permission required": "권한이 없습니다.",
    "INVALID_ID": "잘못된 요청입니다.",
    "SLUG_REQUIRED": "slug는 필수입니다.",
    "NAME_REQUIRED": "이름은 필수입니다.",
    "INVALID_STATUS": "상태값이 올바르지 않습니다.",
    "SLUG_ALREADY_EXISTS": "이미 사용 중인 slug 입니다.",
    "PRIMARY_DOMAIN_ALREADY_EXISTS": "이미 사용 중인 도메인입니다.",
    "TENANT_NOT_FOUND": "지점을 찾을 수 없습니다.",
};

function translateError(code: string | undefined): string {
    if (!code) return "저장 중 오류가 발생했습니다.";
    return ERROR_MAP[code] ?? "저장 중 오류가 발생했습니다.";
}

export default function SellerTenantFormClient({
    mode,
    tenant,
}: {
    mode: "new" | "edit";
    tenant?: TenantDto;
}) {
    const router = useRouter();
    const [slug, setSlug] = useState(tenant?.slug ?? "");
    const [name, setName] = useState(tenant?.name ?? "");
    const [status, setStatus] = useState<string>(tenant?.status ?? "active");
    const [primaryDomain, setPrimaryDomain] = useState(tenant?.primaryDomain ?? "");
    const [openchatUrl, setOpenchatUrl] = useState(tenant?.openchatUrl ?? "");
    const [saving, setSaving] = useState(false);
    const [deactivating, setDeactivating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEdit = mode === "edit";

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const trimmedSlug = slug.trim();
        const trimmedName = name.trim();
        if (!isEdit && !trimmedSlug) {
            setError("slug는 필수입니다.");
            return;
        }
        if (!trimmedName) {
            setError("이름은 필수입니다.");
            return;
        }

        setSaving(true);
        try {
            const url = isEdit
                ? `/api/proxy/v1/seller/tenants/${tenant!.id}`
                : "/api/proxy/v1/seller/tenants";
            const method = isEdit ? "PUT" : "POST";
            const body = isEdit
                ? {
                      name: trimmedName,
                      status,
                      primaryDomain: primaryDomain.trim(),
                      openchatUrl: openchatUrl.trim(),
                  }
                : {
                      slug: trimmedSlug,
                      name: trimmedName,
                      status,
                      primaryDomain: primaryDomain.trim(),
                      openchatUrl: openchatUrl.trim(),
                  };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.ok) {
                setError(translateError(json?.message));
                return;
            }
            router.push("/__all__/tenants");
            router.refresh();
        } catch {
            setError("네트워크 오류 — 잠시 후 다시 시도해 주세요.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDeactivate() {
        if (!isEdit || !tenant) return;
        if (
            !window.confirm(
                "이 지점을 비활성화하시겠습니까? 사이트 접근이 차단되지만 데이터는 보존됩니다."
            )
        )
            return;

        setDeactivating(true);
        setError(null);
        try {
            const res = await fetch(`/api/proxy/v1/seller/tenants/${tenant.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ status: "inactive" }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.ok) {
                setError(translateError(json?.message));
                return;
            }
            router.push("/__all__/tenants");
            router.refresh();
        } catch {
            setError("네트워크 오류 — 잠시 후 다시 시도해 주세요.");
        } finally {
            setDeactivating(false);
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
        >
            <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                {isEdit ? "지점 수정" : "지점 신규 등록"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
                {isEdit
                    ? "지점 정보를 수정합니다. slug는 변경할 수 없습니다."
                    : "새 지점을 등록합니다. slug는 생성 후 변경할 수 없습니다."}
            </p>

            {error ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            ) : null}

            <div className="mt-6 space-y-4">
                <div>
                    <label className="text-xs font-semibold text-slate-500">
                        slug{isEdit ? " (수정 불가)" : ""}
                    </label>
                    <input
                        type="text"
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        disabled={isEdit}
                        placeholder="예) a"
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500">이름</label>
                    <input
                        type="text"
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="예) A지점"
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500">상태</label>
                    <select
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                        <option value="draft">draft</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500">도메인</label>
                    <input
                        type="text"
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        value={primaryDomain}
                        onChange={(e) => setPrimaryDomain(e.target.value)}
                        placeholder="예) a.discountallday.kr"
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500">오픈채팅 URL</label>
                    <input
                        type="text"
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        value={openchatUrl}
                        onChange={(e) => setOpenchatUrl(e.target.value)}
                        placeholder="https://open.kakao.com/o/..."
                    />
                </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={() => router.push("/__all__/tenants")}
                    disabled={saving || deactivating}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-60"
                >
                    취소
                </button>
                {isEdit && status !== "inactive" ? (
                    <button
                        type="button"
                        onClick={handleDeactivate}
                        disabled={saving || deactivating}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                        {deactivating ? "비활성화 중..." : "이 지점 비활성화"}
                    </button>
                ) : null}
                <button
                    type="submit"
                    disabled={saving || deactivating}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                    {saving ? "저장 중..." : "저장"}
                </button>
            </div>
        </form>
    );
}
```

- [ ] **Step 2: Next typecheck 통과 확인**

Run: `cd "E:/dev/dev_elco/store-franchise" && npx tsc --noEmit 2>&1 | tail -5; echo "EXIT=$?"`
Expected: EXIT=0

- [ ] **Step 3: 커밋**

```bash
git -C "E:/dev/dev_elco/store-franchise" add src/components/seller/SellerTenantFormClient.tsx
git -C "E:/dev/dev_elco/store-franchise" commit -m "feat(seller-ui): SellerTenantFormClient (shared new/edit form)"
```

---

## Task 7: SellerTenantsListClient (목록 클라이언트)

**Files:**
- Create: `src/components/seller/SellerTenantsListClient.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
// src/components/seller/SellerTenantsListClient.tsx
"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

type TenantItem = {
    id: number;
    slug: string;
    name: string;
    status: string;
    primaryDomain: string | null;
    openchatUrl: string | null;
};

function StatusBadge({ status }: { status: string }) {
    const cls =
        status === "active"
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
            : status === "draft"
                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
    return (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
            {status}
        </span>
    );
}

export default function SellerTenantsListClient({ items }: { items: TenantItem[] }) {
    return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                        지점 관리
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        최고권한자 전용 — 지점 추가·수정·비활성화
                    </p>
                </div>
                <Link
                    href="/__all__/tenants/new"
                    className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                >
                    <Plus className="h-4 w-4" />
                    신규 지점
                </Link>
            </div>

            {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                    등록된 지점이 없습니다.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                <th className="px-3 py-2">이름</th>
                                <th className="px-3 py-2">slug</th>
                                <th className="px-3 py-2">상태</th>
                                <th className="px-3 py-2">도메인</th>
                                <th className="px-3 py-2 text-right">&nbsp;</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((t) => (
                                <tr
                                    key={t.id}
                                    className="border-b border-slate-100 hover:bg-slate-50"
                                >
                                    <td className="px-3 py-3 font-semibold text-slate-900">
                                        {t.name}
                                    </td>
                                    <td className="px-3 py-3 font-mono text-xs text-slate-600">
                                        {t.slug}
                                    </td>
                                    <td className="px-3 py-3">
                                        <StatusBadge status={t.status} />
                                    </td>
                                    <td className="px-3 py-3 text-slate-600">
                                        {t.primaryDomain ?? "-"}
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                        <Link
                                            href={`/__all__/tenants/${t.id}`}
                                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                        >
                                            수정
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Next typecheck**

Run: `cd "E:/dev/dev_elco/store-franchise" && npx tsc --noEmit 2>&1 | tail -5; echo "EXIT=$?"`
Expected: EXIT=0

- [ ] **Step 3: 커밋**

```bash
git -C "E:/dev/dev_elco/store-franchise" add src/components/seller/SellerTenantsListClient.tsx
git -C "E:/dev/dev_elco/store-franchise" commit -m "feat(seller-ui): SellerTenantsListClient (tenant list table)"
```

---

## Task 8: 목록 페이지 (서버) — `tenants/page.tsx`

**Files:**
- Create: `src/app/(seller)/seller/[tenant]/tenants/page.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
// src/app/(seller)/seller/[tenant]/tenants/page.tsx
import { cookies, headers } from "next/headers";
import SellerTenantsListClient from "@/components/seller/SellerTenantsListClient";

export const dynamic = "force-dynamic";

function getInternalOrigin() {
    return (
        process.env.NEXT_INTERNAL_ORIGIN ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://127.0.0.1:3000"
    );
}

async function getCookieHeader() {
    const store = await cookies();
    return store.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
}

export default async function SellerTenantsPage({
    params,
}: {
    params: Promise<{ tenant: string }>;
}) {
    const { tenant } = await params;

    const origin = getInternalOrigin();
    const cookieHeader = await getCookieHeader();
    const hostHeader = (await headers()).get("host") || "";

    const res = await fetch(`${origin}/api/proxy/v1/seller/tenants?status=all`, {
        cache: "no-store",
        headers: {
            cookie: cookieHeader,
            "x-tenant-slug": tenant,
            "x-forwarded-host": hostHeader,
        },
    });
    const data = await res.json().catch(() => null);
    const items = Array.isArray(data?.items) ? data.items : [];

    return <SellerTenantsListClient items={items} />;
}
```

- [ ] **Step 2: Next typecheck**

Run: `cd "E:/dev/dev_elco/store-franchise" && npx tsc --noEmit 2>&1 | tail -5; echo "EXIT=$?"`
Expected: EXIT=0

- [ ] **Step 3: 커밋**

```bash
git -C "E:/dev/dev_elco/store-franchise" add "src/app/(seller)/seller/[tenant]/tenants/page.tsx"
git -C "E:/dev/dev_elco/store-franchise" commit -m "feat(seller-ui): tenants list page"
```

---

## Task 9: 신규 페이지 (서버) — `tenants/new/page.tsx`

**Files:**
- Create: `src/app/(seller)/seller/[tenant]/tenants/new/page.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
// src/app/(seller)/seller/[tenant]/tenants/new/page.tsx
import SellerTenantFormClient from "@/components/seller/SellerTenantFormClient";

export const dynamic = "force-dynamic";

export default function SellerTenantNewPage() {
    return <SellerTenantFormClient mode="new" />;
}
```

- [ ] **Step 2: Next typecheck**

Run: `cd "E:/dev/dev_elco/store-franchise" && npx tsc --noEmit 2>&1 | tail -5; echo "EXIT=$?"`
Expected: EXIT=0

- [ ] **Step 3: 커밋**

```bash
git -C "E:/dev/dev_elco/store-franchise" add "src/app/(seller)/seller/[tenant]/tenants/new/page.tsx"
git -C "E:/dev/dev_elco/store-franchise" commit -m "feat(seller-ui): tenant new page"
```

---

## Task 10: 수정 페이지 (서버) — `tenants/[id]/page.tsx`

**Files:**
- Create: `src/app/(seller)/seller/[tenant]/tenants/[id]/page.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
// src/app/(seller)/seller/[tenant]/tenants/[id]/page.tsx
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import SellerTenantFormClient from "@/components/seller/SellerTenantFormClient";

export const dynamic = "force-dynamic";

function getInternalOrigin() {
    return (
        process.env.NEXT_INTERNAL_ORIGIN ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://127.0.0.1:3000"
    );
}

async function getCookieHeader() {
    const store = await cookies();
    return store.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
}

export default async function SellerTenantEditPage({
    params,
}: {
    params: Promise<{ tenant: string; id: string }>;
}) {
    const { tenant, id } = await params;
    if (!/^\d+$/.test(id)) notFound();

    const origin = getInternalOrigin();
    const cookieHeader = await getCookieHeader();
    const hostHeader = (await headers()).get("host") || "";

    const res = await fetch(`${origin}/api/proxy/v1/seller/tenants/${id}`, {
        cache: "no-store",
        headers: {
            cookie: cookieHeader,
            "x-tenant-slug": tenant,
            "x-forwarded-host": hostHeader,
        },
    });
    if (!res.ok) notFound();
    const data = await res.json().catch(() => null);
    if (!data?.ok || !data.tenant) notFound();

    return <SellerTenantFormClient mode="edit" tenant={data.tenant} />;
}
```

- [ ] **Step 2: Next typecheck**

Run: `cd "E:/dev/dev_elco/store-franchise" && npx tsc --noEmit 2>&1 | tail -5; echo "EXIT=$?"`
Expected: EXIT=0

- [ ] **Step 3: 커밋**

```bash
git -C "E:/dev/dev_elco/store-franchise" add "src/app/(seller)/seller/[tenant]/tenants/[id]/page.tsx"
git -C "E:/dev/dev_elco/store-franchise" commit -m "feat(seller-ui): tenant edit page"
```

---

## Task 11: 사이드바 "지점 관리" 메뉴 추가 (SellerShell)

**Files:**
- Modify: `src/components/seller/SellerShell.tsx`

3개 위치를 차례로 수정한다.

- [ ] **Step 1: lucide-react import 에 `Building2` 추가**

`src/components/seller/SellerShell.tsx` 의 6-17 라인 부근, 기존 import:

```tsx
import {
    LayoutDashboard,
    ShoppingBag,
    Users,
    BarChart3,
    LogIn,
    LogOut,
    Menu,
    X,
    ShieldCheck,
    ChevronsUpDown,
} from "lucide-react";
```

를 다음으로 교체 (마지막 항목 뒤에 `Building2` 추가):

```tsx
import {
    LayoutDashboard,
    ShoppingBag,
    Users,
    BarChart3,
    LogIn,
    LogOut,
    Menu,
    X,
    ShieldCheck,
    ChevronsUpDown,
    Building2,
} from "lucide-react";
```

- [ ] **Step 2: `tenantsHref` 상수 추가**

100 라인 부근 기존:

```tsx
    const applicationsHref = `/${tenant}/applications`;
```

바로 아래 줄에 다음 추가:

```tsx
    const tenantsHref = `/${tenant}/tenants`;
```

- [ ] **Step 3: `isTenantsActive` 상수 추가**

112 라인 부근 기존:

```tsx
    const isApplicationsActive =
```

가 있는 줄(들)을 찾아 그 블록 바로 뒤 (즉 `isApplicationsActive` 정의가 끝난 다음 줄)에 다음 추가:

```tsx
    const isTenantsActive =
        pathname === tenantsHref || pathname.startsWith(`${tenantsHref}/`);
```

- [ ] **Step 4: 메뉴에 NavItem 추가**

기존 `isSuperAdmin ? ( <NavItem ... 셀러 승인 관리 ... /> ) : null` 블록(316-325 라인 부근) **닫는 괄호 다음 줄**에 다음 NavItem 추가:

```tsx
                {isSuperAdmin ? (
                    <NavItem
                        href={tenantsHref}
                        label="지점 관리"
                        icon={Building2}
                        active={isTenantsActive}
                        onClick={closeMobileMenu}
                        highlight={!isTenantsActive}
                    />
                ) : null}
```

즉 결과적으로 두 개의 `isSuperAdmin ? (...) : null` 블록이 연달아 나오게 된다 — 첫 번째는 셀러 승인 관리, 두 번째는 지점 관리.

- [ ] **Step 5: Next typecheck**

Run: `cd "E:/dev/dev_elco/store-franchise" && npx tsc --noEmit 2>&1 | tail -5; echo "EXIT=$?"`
Expected: EXIT=0

- [ ] **Step 6: 커밋**

```bash
git -C "E:/dev/dev_elco/store-franchise" add src/components/seller/SellerShell.tsx
git -C "E:/dev/dev_elco/store-franchise" commit -m "feat(seller-ui): add 지점 관리 sidebar item (hq_super only)"
```

---

## Task 12: 최종 통합 검증 (typecheck + build + 수동 체크리스트)

**Files:** (검증만)

- [ ] **Step 1: API typecheck 통과 재확인**

Run: `cd "E:/dev/dev_elco/store-franchise/apps/api" && npx tsc -p tsconfig.json --noEmit 2>&1 | tail -5; echo "EXIT=$?"`
Expected: EXIT=0

- [ ] **Step 2: Next typecheck 통과 재확인**

Run: `cd "E:/dev/dev_elco/store-franchise" && npx tsc --noEmit 2>&1 | tail -5; echo "EXIT=$?"`
Expected: EXIT=0

- [ ] **Step 3: API 빌드 확인**

Run: `cd "E:/dev/dev_elco/store-franchise/apps/api" && npm run build 2>&1 | tail -5; echo "EXIT=$?"`
Expected: EXIT=0, `tsc -p tsconfig.json` 정상 완료

- [ ] **Step 4: Next 빌드 확인**

Run: `cd "E:/dev/dev_elco/store-franchise" && npm run build 2>&1 | tail -10; echo "EXIT=$?"`
Expected: EXIT=0, "Compiled successfully" 또는 동등 메시지

- [ ] **Step 5: 수동 시나리오 체크리스트 (배포 후 실제 사이트에서 1회 점검)**

배포 후 다음을 사람이 직접 클릭/확인:

- [ ] hq_super 가 아닌 셀러(seller_owner) 로 `https://seller.discountallday.kr/__all__/tenants` 접근 → "셀러 권한이 필요합니다" 화면(SellerNoAccess) 으로 차단되는지
- [ ] hq_super 로 진입 → 활성 + 비활성/draft 지점이 모두 목록에 보이는지 (status 필터 `all`)
- [ ] 사이드바에 "지점 관리" 메뉴가 hq_super 에게만 보이는지
- [ ] "+ 신규 지점" → 새 지점 등록 → 목록에 즉시 반영되는지
- [ ] 같은 slug 로 다시 등록 시도 → "이미 사용 중인 slug 입니다" 에러
- [ ] 도메인 중복 시도 → "이미 사용 중인 도메인입니다" 에러
- [ ] 기존 지점 수정 (이름·도메인·오픈채팅URL) → 저장 후 다시 들어가도 값 유지
- [ ] 수정 화면에서 slug 필드가 disabled (readonly) 상태인지
- [ ] "이 지점 비활성화" 버튼 → confirm → status=inactive 변경 → 목록에 회색 배지로 표시
- [ ] 비활성화된 지점의 사이트 (`{slug}.discountallday.kr`) 접근 차단되는지
- [ ] 비활성화된 지점의 수정 화면에서 status 드롭다운으로 active 재선택 + 저장 → 사이트 다시 살아나는지
- [ ] 셀러 페이지의 테넌트 스위처에 새로 추가한 active 지점이 보이는지

- [ ] **Step 6: 배포 명령 (운영 서버에서 실행)**

```bash
cd /var/www/shop-next
git pull origin main

# API 변경 포함 → 재빌드 + 재시작
cd apps/api
npm run build
pm2 restart discountallday-api

# 프론트 변경 포함 → 재빌드 + 재시작
cd /var/www/shop-next
npm run build
pm2 restart shop-next
```

- [ ] **Step 7: 배포 후 Task 5 의 cURL 가드 검증을 운영 환경에서 한 번 더 실행 (선택)**

운영 hq_admin 세션 쿠키로 POST 시도 → 403 확인.

---

## Self-Review 결과 (작성 시점)

- **Spec coverage:** 스펙 1~10 절의 모든 요구사항이 Task 1~12 에 매핑됨. 9절(out-of-scope)은 그대로 제외.
- **Placeholder scan:** TBD/TODO/임시값 없음. 각 코드 블록이 완전한 형태.
- **Type consistency:** `TenantDto` (FormClient) / `TenantItem` (ListClient) 둘 다 `id:number / slug:string / name:string / status:string / primaryDomain:string|null / openchatUrl:string|null` 키 사용, FormClient 만 추가로 `timezone?:string` 보유. API 응답의 GET:id 가 timezone 포함하므로 일치. 메서드명 `requireHqSuper`, `parseOpenchatUrl`, `mergeOpenchatUrl` 은 Task 1~4 전반에서 동일하게 사용됨.
- **Scope check:** 단일 기능(셀러 측 hq_super 전용 tenant CRUD UI) 으로 잘 한정되어 있음.
