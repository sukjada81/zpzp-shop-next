import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";

export type AdminLinkerScope = {
    linkerUid: number;
    shopSlug: string;
    shopName: string;
    memberUids: number[];
};

/** query linker=all|{uid} → 활성 링커 스코프. all/빈값이면 null */
export async function resolveAdminLinkerScope(
    app: FastifyInstance,
    linkerRaw: unknown
): Promise<{ ok: true; scope: AdminLinkerScope | null } | { ok: false; message: string }> {
    const raw = String(linkerRaw ?? "all").trim().toLowerCase();
    if (!raw || raw === "all") return { ok: true, scope: null };

    if (!/^\d+$/.test(raw)) {
        return { ok: false, message: "invalid linker" };
    }

    const linkerUid = Number(raw);
    const linker = await app.prisma.zpzp_linker.findFirst({
        where: { uid: linkerUid, status: "active" },
        select: { uid: true, shop_slug: true, shop_name: true },
    });
    if (!linker) return { ok: false, message: "invalid linker" };

    const attributions = await app.prisma.zpzp_referral_attribution.findMany({
        where: { linker_id: linker.uid },
        select: { member_uid: true },
    });
    const memberUids = attributions
        .map((row) => Number(row.member_uid))
        .filter((uid) => Number.isFinite(uid) && uid > 0);

    return {
        ok: true,
        scope: {
            linkerUid: linker.uid,
            shopSlug: String(linker.shop_slug ?? ""),
            shopName: String(linker.shop_name ?? linker.shop_slug ?? ""),
            memberUids,
        },
    };
}

/** 주문: 결제 스토어 slug 또는 귀속 회원 (셀러 콘솔과 동일) */
export function orderInfoWhereForAdminLinker(
    base: Prisma.mallRN_order_infoWhereInput,
    scope: AdminLinkerScope | null
): Prisma.mallRN_order_infoWhereInput {
    if (!scope) return base;

    const or: Prisma.mallRN_order_infoWhereInput[] = [];
    if (scope.shopSlug) {
        or.push({ checkout_shop_slug: scope.shopSlug });
    }
    if (scope.memberUids.length > 0) {
        or.push({
            member_uid: { in: scope.memberUids.map((uid) => BigInt(uid)) },
        });
    }
    if (!or.length) {
        return { ...base, uid: { in: [] } };
    }
    return { ...base, OR: or };
}

/** 링커가 선택한 상품 uid 목록 */
export async function productUidsForAdminLinker(
    app: FastifyInstance,
    scope: AdminLinkerScope | null
): Promise<number[] | null> {
    if (!scope) return null;

    const rows = await app.prisma.mallRN_linker_products.findMany({
        where: {
            linker_uid: scope.linkerUid,
            selection_status: "selected",
        },
        select: { product_uid: true },
    });
    return rows.map((row) => Number(row.product_uid)).filter((uid) => Number.isFinite(uid) && uid > 0);
}
