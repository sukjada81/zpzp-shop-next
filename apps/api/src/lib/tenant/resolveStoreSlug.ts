// apps/api/src/lib/tenant/resolveStoreSlug.ts
import type { PrismaClient } from "@prisma/client";

/**
 * 스토어 slug → 카탈로그 tenant 공용 리졸버.
 *
 * 줍줍에는 "스토어 주소로 쓰이는 slug"가 두 종류다.
 *   - 점포 slug : dad_tenants.slug (ilsan-janghang, hq …)
 *   - 링커 slug : zpzp_linker.shop_slug (아이디.zpzp.kr)
 * 링커 slug 는 tenant 가 아니라서, 이 구분을 각 라우트가 제각기 처리하다
 * "모르면 첫 점포로 붙이는" fail-open 이 생겼고 엉뚱한 매장으로 세션이 붙었다.
 * 규칙을 여기 한 곳에 모은다.
 *
 * ## 해석 규칙 (순서 고정)
 *  ① dad_tenants 에 active 로 매치 → 그 tenant (kind: "tenant")
 *  ② zpzp_linker 에 status=active 로 매치 → 카탈로그 tenant (kind: "linker")
 *       - linker.tenant_id 가 지정돼 있고 그 점포가 active 면 그 점포
 *       - 아니면 본사몰(hq) 카탈로그
 *  ③ 그 외 전부 실패 (fail-closed)
 *       - 미존재 slug            → NOT_FOUND
 *       - pending/suspended/rejected 링커 → LINKER_INACTIVE
 *         (비활성 링커 스토어는 열리면 안 된다)
 *       - 링커는 active 인데 카탈로그 tenant 가 없으면 → CATALOG_MISSING
 *
 * 호출부는 실패를 400 등 명시 에러로 처리한다. 절대 기본 점포로 접지 말 것.
 */

export const CATALOG_TENANT_SLUG = "hq";

export type StoreSlugResolution =
    | {
          ok: true;
          kind: "tenant" | "linker";
          tenantId: bigint;
          tenantSlug: string;
          tenantName: string;
          /** kind==="linker" 일 때만 채워진다 */
          linkerUid?: number;
          linkerSlug?: string;
      }
    | {
          ok: false;
          reason: "EMPTY" | "NOT_FOUND" | "LINKER_INACTIVE" | "CATALOG_MISSING";
      };

/**
 * 캐시 정책 — 성공만 60초 캐시하고 실패는 캐시하지 않는다.
 *
 * 실패를 캐시하면 "링커 승인 직후 로그인" 이 최대 TTL 만큼 막힌다(승인 전 조회가
 * NOT_FOUND 로 굳는다). 승인 직후 즉시 통과가 요구사항이므로 실패는 매번 DB 를 본다.
 * 실패 경로는 정상 운영에서 드물어 부하가 아니다.
 * 성공 60초는 로그인 같은 저빈도 경로에 충분하고, 링커 정지(suspend) 반영도 1분 내다.
 */
const SUCCESS_TTL_MS = 60_000;

type CacheEntry = { value: Extract<StoreSlugResolution, { ok: true }>; expiresAt: number };

const cache = new Map<string, CacheEntry>();

/** 테스트·운영 훅용 — 링커 상태를 즉시 반영해야 할 때 비운다. */
export function clearStoreSlugCache(slug?: string) {
    if (slug) cache.delete(normalizeSlug(slug));
    else cache.clear();
}

function normalizeSlug(raw: unknown) {
    return String(raw ?? "").trim().toLowerCase();
}

export async function resolveStoreSlug(
    prisma: PrismaClient,
    rawSlug: unknown,
    now: number = Date.now()
): Promise<StoreSlugResolution> {
    const slug = normalizeSlug(rawSlug);
    if (!slug) return { ok: false, reason: "EMPTY" };

    const hit = cache.get(slug);
    if (hit && hit.expiresAt > now) return hit.value;
    if (hit) cache.delete(slug);

    // ① 점포 slug
    const tenant = await prisma.tenant.findFirst({
        where: { slug, status: "active" },
        select: { id: true, slug: true, name: true },
    });

    if (tenant) {
        return remember(slug, now, {
            ok: true,
            kind: "tenant",
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            tenantName: tenant.name,
        });
    }

    // ② 링커 slug — status 무관하게 먼저 찾아서 "없음"과 "비활성"을 구분한다.
    const linker = await prisma.zpzp_linker.findFirst({
        where: { shop_slug: slug },
        select: { uid: true, shop_slug: true, tenant_id: true, status: true },
    });

    if (!linker) return { ok: false, reason: "NOT_FOUND" };
    if (linker.status !== "active") return { ok: false, reason: "LINKER_INACTIVE" };

    const catalog =
        (linker.tenant_id
            ? await prisma.tenant.findFirst({
                  where: { id: linker.tenant_id, status: "active" },
                  select: { id: true, slug: true, name: true },
              })
            : null) ??
        (await prisma.tenant.findFirst({
            where: { slug: CATALOG_TENANT_SLUG, status: "active" },
            select: { id: true, slug: true, name: true },
        }));

    if (!catalog) return { ok: false, reason: "CATALOG_MISSING" };

    return remember(slug, now, {
        ok: true,
        kind: "linker",
        tenantId: catalog.id,
        tenantSlug: catalog.slug,
        tenantName: catalog.name,
        linkerUid: linker.uid,
        linkerSlug: linker.shop_slug,
    });
}

function remember(
    slug: string,
    now: number,
    value: Extract<StoreSlugResolution, { ok: true }>
): StoreSlugResolution {
    cache.set(slug, { value, expiresAt: now + SUCCESS_TTL_MS });
    return value;
}
