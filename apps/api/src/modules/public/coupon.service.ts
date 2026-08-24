// apps/api/src/modules/public/coupon.service.ts
// 스토어 주문 쿠폰 적용 + 중복(스택) 토글 — W-1. 스펙 shop-php/docs/superpowers/specs/2026-07-27-store-coupon-stack-design.md
//
// 산식은 shop-php `getCouponPrice`(lib/lib.Shop.php:202) / `priceLimit`(:1012)를 의도적으로 미러한다.
// 정책(스펙 D2): 두 쿠폰 모두 '할인 전 상품합계(subtotal)' 기준으로 병렬 계산 → 적용 순서와 무관하게 결정적.
// 기록 순서(D3): 일반 쿠폰 먼저(sort_order=0) → 웰컴머니 나중(sort_order=1).

import type { Prisma, PrismaClient } from "@prisma/client";

export type CouponKind = "normal" | "welcome";

export type CouponRow = {
    couponUid: number;
    cUid: number;
    kind: CouponKind;
    amount: number;
    sortOrder: number;
};

export type AvailableCoupon = {
    couponUid: number;
    cUid: number;
    name: string;
    kind: CouponKind;
    discount: number;
    usable: boolean;
    reason: string;
    minOrder: number;
    endDate: string | null;
};

export type CouponSelection =
    | { ok: true; discountTotal: number; rows: CouponRow[] }
    | { ok: false; message: string };

type PrismaLike = PrismaClient | Prisma.TransactionClient;

const STACK_SETTING_KEY = "coupon_stack_allowed";
const WELCOME_UID_SETTING_KEY = "welcome_coupon_uid";

function toInt(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** zpzp_setting 단건 조회. 테이블/키 부재는 조용히 null(부분배포 방어). */
async function readSetting(prisma: PrismaLike, name: string): Promise<string | null> {
    try {
        const row = await prisma.zpzp_setting.findUnique({ where: { name } });
        return row ? String(row.value) : null;
    } catch {
        return null;
    }
}

/** 쿠폰 중복(스택) 허용 여부. 기본 ON — 설정 부재 시에도 ON(스펙 D1). */
export async function isCouponStackAllowed(prisma: PrismaLike): Promise<boolean> {
    const raw = await readSetting(prisma, STACK_SETTING_KEY);
    if (raw === null) return true;
    return raw.trim() !== "0";
}

/** 웰컴쿠폰 정의 uid(mallRN_coupon_manager.uid). 하드코딩 금지 — 설정이 단일 진실원. */
export async function getWelcomeCouponDefUid(prisma: PrismaLike): Promise<number> {
    const raw = await readSetting(prisma, WELCOME_UID_SETTING_KEY);
    return raw ? toInt(raw, 0) : 0;
}

/** shop-php priceLimit(lib.Shop.php:1012) 미러. mallRN_configuration 절사 설정에 따른 라운딩. */
async function priceLimit(prisma: PrismaLike, price: number): Promise<number> {
    let type1 = 0;
    let type2 = 0;

    try {
        const conf = await prisma.mallRN_configuration.findUnique({
            where: { uid: 1 },
            select: { goods_price_limit1: true, goods_price_limit2: true },
        });
        type1 = toInt(conf?.goods_price_limit1, 0);
        type2 = toInt(conf?.goods_price_limit2, 0);
    } catch {
        return Math.trunc(price);
    }

    if (type1 <= 0 || type2 <= 0) return Math.trunc(price);

    const unit = 10 * type1;
    if (unit <= 0) return Math.trunc(price);

    if (type2 === 1) return Math.trunc(Math.floor(price / unit) * unit);
    if (type2 === 2) return Math.trunc(Math.round(price / unit) * unit);
    if (type2 === 3) return Math.trunc(Math.ceil(price / unit) * unit);
    return Math.trunc(price);
}

export type CouponManagerRow = {
    uid: number;
    name: string;
    type: number;
    discount: number;
    discount_type: string;
    discount_limit: number;
    use_type: number;
    use_s_date: Date | null;
    use_e_date: Date | null;
    use_limit: number;
};

/**
 * shop-php getCouponPrice(lib.Shop.php:202) 미러의 순수 부분. 사용 불가면 0.
 * 라운딩(priceLimit)은 설정 의존이라 주입받는다 — DB 없이 단위 테스트 가능하게.
 */
export function evaluateCouponDiscount(
    def: CouponManagerRow,
    subtotal: number,
    round: (value: number) => number,
    now: Date = new Date()
): { discount: number; reason: string } {
    if (toInt(def.use_type, 0) === 0) {
        if (def.use_s_date && def.use_s_date > now) return { discount: 0, reason: "사용 시작 전" };
        if (def.use_e_date && def.use_e_date < now) return { discount: 0, reason: "기간 만료" };
    }

    const useLimit = toInt(def.use_limit, 0);
    if (useLimit > 0 && toInt(def.type, 0) !== 4) {
        if (subtotal < useLimit) {
            return {
                discount: 0,
                reason: `사용불가(${useLimit.toLocaleString("ko-KR")}원 이상)`,
            };
        }
    }

    if (String(def.discount_type) === "P") {
        let discount = round((subtotal * toInt(def.discount, 0)) / 100);
        const cap = toInt(def.discount_limit, 0);
        if (cap > 0 && discount > cap) discount = cap;
        return { discount, reason: "" };
    }

    return { discount: toInt(def.discount, 0), reason: "" };
}

/** 과할인 클램프: 할인 합계가 상품합계를 넘지 않게. 초과분은 뒤(웰컴)에서 깎는다. rows 를 제자리 수정. */
export function clampCouponRows(rows: CouponRow[], subtotal: number): number {
    let total = rows.reduce((sum, r) => sum + r.amount, 0);
    if (total <= subtotal) return total;

    let over = total - subtotal;
    for (let i = rows.length - 1; i >= 0 && over > 0; i -= 1) {
        const cut = Math.min(rows[i].amount, over);
        rows[i].amount -= cut;
        over -= cut;
    }
    total = rows.reduce((sum, r) => sum + r.amount, 0);
    return total;
}

async function computeCouponDiscount(
    prisma: PrismaLike,
    def: CouponManagerRow,
    subtotal: number
): Promise<{ discount: number; reason: string }> {
    if (String(def.discount_type) !== "P") {
        return evaluateCouponDiscount(def, subtotal, (v) => Math.trunc(v));
    }
    // 정률만 라운딩 설정이 필요 → 그 경우에만 조회
    const rounded = await priceLimit(prisma, (subtotal * toInt(def.discount, 0)) / 100);
    return evaluateCouponDiscount(def, subtotal, () => rounded);
}

/** member_uid → mallRN_member.id(로그인 id). mallRN_coupon 은 로그인 id 로 소유자를 식별한다. */
export async function resolveMemberLoginId(
    prisma: PrismaLike,
    memberUid: bigint | number
): Promise<string> {
    const uid = typeof memberUid === "bigint" ? Number(memberUid) : toInt(memberUid, 0);
    if (uid <= 0) return "";
    const member = await prisma.mallRN_member.findUnique({
        where: { uid },
        select: { id: true },
    });
    return String(member?.id ?? "");
}

type HeldCoupon = {
    couponUid: number;
    cUid: number;
    def: CouponManagerRow;
    kind: CouponKind;
};

/** 회원이 보유한 '장바구니 쿠폰'(g_uid=0, 미사용, 미만료) + 정의 로드. */
async function loadHeldCoupons(
    prisma: PrismaLike,
    loginId: string,
    welcomeDefUid: number
): Promise<HeldCoupon[]> {
    if (!loginId) return [];

    const coupons = await prisma.mallRN_coupon.findMany({
        where: {
            id: loginId,
            g_uid: 0,
            status: 0,
            e_date: { gt: new Date() },
        },
        select: { uid: true, c_uid: true },
        orderBy: { uid: "desc" },
    });

    if (!coupons.length) return [];

    const defs = await prisma.mallRN_coupon_manager.findMany({
        where: { uid: { in: coupons.map((c) => c.c_uid) } },
        select: {
            uid: true,
            name: true,
            type: true,
            discount: true,
            discount_type: true,
            discount_limit: true,
            use_type: true,
            use_s_date: true,
            use_e_date: true,
            use_limit: true,
        },
    });

    const defMap = new Map<number, CouponManagerRow>();
    for (const d of defs) {
        defMap.set(d.uid, {
            uid: d.uid,
            name: String(d.name ?? ""),
            type: toInt(d.type, 0),
            discount: toInt(d.discount, 0),
            discount_type: String(d.discount_type ?? "P"),
            discount_limit: toInt(d.discount_limit, 0),
            use_type: toInt(d.use_type, 0),
            use_s_date: d.use_s_date ?? null,
            use_e_date: d.use_e_date ?? null,
            use_limit: toInt(d.use_limit, 0),
        });
    }

    const held: HeldCoupon[] = [];
    for (const c of coupons) {
        const def = defMap.get(c.c_uid);
        if (!def) continue;
        held.push({
            couponUid: c.uid,
            cUid: c.c_uid,
            def,
            kind: welcomeDefUid > 0 && c.c_uid === welcomeDefUid ? "welcome" : "normal",
        });
    }

    return held;
}

/** 주문서 쿠폰 섹션용 목록. 사용불가 쿠폰도 사유와 함께 반환한다(UI가 disabled 표기). */
export async function listAvailableCoupons(
    prisma: PrismaLike,
    memberUid: bigint | number,
    subtotal: number
): Promise<{ stackAllowed: boolean; coupons: AvailableCoupon[] }> {
    const stackAllowed = await isCouponStackAllowed(prisma);
    const loginId = await resolveMemberLoginId(prisma, memberUid);
    if (!loginId) return { stackAllowed, coupons: [] };

    const welcomeDefUid = await getWelcomeCouponDefUid(prisma);
    const held = await loadHeldCoupons(prisma, loginId, welcomeDefUid);

    const coupons: AvailableCoupon[] = [];
    for (const h of held) {
        const { discount, reason } = await computeCouponDiscount(prisma, h.def, subtotal);
        coupons.push({
            couponUid: h.couponUid,
            cUid: h.cUid,
            name: h.def.name,
            kind: h.kind,
            discount,
            usable: discount > 0,
            reason,
            minOrder: h.def.use_limit,
            endDate: h.def.use_e_date ? h.def.use_e_date.toISOString() : null,
        });
    }

    // 웰컴머니를 뒤로(D3 표기 순서), 그 안에서는 할인액 큰 순.
    coupons.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "welcome" ? 1 : -1;
        return b.discount - a.discount;
    });

    return { stackAllowed, coupons };
}

/**
 * 선택된 쿠폰을 검증하고 확정 할인액을 계산한다. 프론트 값은 신뢰하지 않는다.
 * 실패 시 사용자 노출용 메시지를 돌려준다(내부 조건 문구 금지).
 */
export async function resolveCouponSelection(
    prisma: PrismaLike,
    memberUid: bigint | number,
    subtotal: number,
    couponUids: number[] | undefined | null
): Promise<CouponSelection> {
    const selected = Array.from(
        new Set((couponUids ?? []).map((v) => toInt(v, 0)).filter((v) => v > 0))
    );

    if (!selected.length) return { ok: true, discountTotal: 0, rows: [] };

    const stackAllowed = await isCouponStackAllowed(prisma);
    if (!stackAllowed && selected.length > 1) {
        return { ok: false, message: "쿠폰은 주문당 1장만 사용할 수 있습니다." };
    }
    if (selected.length > 2) {
        return { ok: false, message: "쿠폰은 최대 2장까지 사용할 수 있습니다." };
    }

    const loginId = await resolveMemberLoginId(prisma, memberUid);
    if (!loginId) return { ok: false, message: "회원 정보를 확인할 수 없습니다." };

    const welcomeDefUid = await getWelcomeCouponDefUid(prisma);
    const held = await loadHeldCoupons(prisma, loginId, welcomeDefUid);
    const heldMap = new Map(held.map((h) => [h.couponUid, h]));

    const rows: CouponRow[] = [];
    let normalCount = 0;
    let welcomeCount = 0;

    for (const couponUid of selected) {
        const h = heldMap.get(couponUid);
        if (!h) return { ok: false, message: "사용할 수 없는 쿠폰이 포함되어 있습니다." };

        const { discount, reason } = await computeCouponDiscount(prisma, h.def, subtotal);
        if (discount <= 0) {
            return {
                ok: false,
                message: reason
                    ? `쿠폰을 사용할 수 없습니다. ${reason}`
                    : "쿠폰을 사용할 수 없습니다.",
            };
        }

        if (h.kind === "welcome") welcomeCount += 1;
        else normalCount += 1;

        rows.push({
            couponUid: h.couponUid,
            cUid: h.cUid,
            kind: h.kind,
            amount: discount,
            sortOrder: h.kind === "welcome" ? 1 : 0,
        });
    }

    if (normalCount > 1 || welcomeCount > 1) {
        return { ok: false, message: "같은 종류의 쿠폰은 1장만 사용할 수 있습니다." };
    }

    // D3: 일반 → 웰컴 순으로 기록
    rows.sort((a, b) => a.sortOrder - b.sortOrder);

    const discountTotal = clampCouponRows(rows, subtotal);

    return { ok: true, discountTotal, rows };
}

/**
 * 쿠폰 소비(사용처리) + 주문별 사용내역 기록. 반드시 주문 생성과 같은 트랜잭션 안에서 호출한다.
 * 조건부 갱신(status=0 → 1)의 count 로 동시 사용을 막는다. 실패 시 throw → 트랜잭션 롤백.
 */
export async function consumeCoupons(
    tx: Prisma.TransactionClient,
    loginId: string,
    rows: CouponRow[],
    orderNum: string,
    ts: number
): Promise<void> {
    if (!rows.length) return;
    if (!loginId) throw new Error("COUPON_OWNER_UNRESOLVED");

    for (const row of rows) {
        const updated = await tx.mallRN_coupon.updateMany({
            where: { uid: row.couponUid, id: loginId, status: 0 },
            data: { status: 1, usedate: ts },
        });

        if (updated.count !== 1) {
            throw new Error(`COUPON_ALREADY_USED:${row.couponUid}`);
        }

        await tx.zpzp_order_coupon.create({
            data: {
                order_num: orderNum,
                coupon_uid: row.couponUid,
                c_uid: row.cUid,
                kind: row.kind,
                amount: row.amount,
                sort_order: row.sortOrder,
                created_at: new Date(ts * 1000),
            },
        });
    }
}

/** order_info.coupon_uid 에 넣을 대표 쿠폰(일반 우선, 없으면 웰컴). 기존 복원 8지점 호환용. */
export function pickRepresentativeCoupon(rows: CouponRow[]): number {
    if (!rows.length) return 0;
    const normal = rows.find((r) => r.kind === "normal");
    return normal ? normal.couponUid : rows[0].couponUid;
}
