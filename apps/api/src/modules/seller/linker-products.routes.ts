import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireTenant } from "../../common/guard.js";

const HQ_TENANT_ID = BigInt(0);
const DEFAULT_SLOT_LIMIT = 20;
const MAX_FILTERED_ALL_RESULTS = 10_000;
const GOODS_STATUS_SELLING = "published"; // product active

type SessionMember = { uid?: string | number };

function memberUid(req: FastifyRequest): number {
    const member = (req as any).session?.member as SessionMember | undefined;
    const uid = Number(member?.uid ?? 0);
    return Number.isInteger(uid) && uid > 0 ? uid : 0;
}

function isSelling(row: {
    status: string;
    sale_use: number;
    deleted_at: Date | null;
    sale_end_at: Date | null;
}) {
    return (
        row.status === GOODS_STATUS_SELLING &&
        row.sale_use === 1 &&
        row.deleted_at == null &&
        (!row.sale_end_at || row.sale_end_at.getTime() >= Date.now())
    );
}

function availableGoodsWhere(selectedIds: number[], keywordRaw: string): Prisma.mallRN_goodsWhereInput {
    const keyword = keywordRaw.trim();
    const search: Prisma.mallRN_goodsWhereInput[] = keyword
        ? [
            { name: { contains: keyword } },
            ...(Number.isInteger(Number(keyword)) && Number(keyword) > 0
                ? [{ uid: Number(keyword) }]
                : []),
        ]
        : [];
    return {
        tenant_id: HQ_TENANT_ID,
        status: GOODS_STATUS_SELLING,
        sale_use: 1,
        auth_ck: "Y",
        deleted_at: null,
        ...(selectedIds.length > 0 ? { uid: { notIn: selectedIds } } : {}),
        AND: [
            { OR: [{ sale_end_at: null }, { sale_end_at: { gte: new Date() } }] },
            ...(search.length > 0 ? [{ OR: search }] : []),
        ],
    };
}

function imageUrl(raw: string | null) {
    const value = String(raw ?? "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    const base = (process.env.GOODS_IMAGE_BASE_URL || "https://discountallday.kr").replace(/\/+$/, "");
    return `${base}/image/goods/img${value.replace(/^\/+/, "")}`;
}

function requestMeta(req: FastifyRequest) {
    return {
        ip_address: req.ip || null,
        user_agent: String(req.headers["user-agent"] ?? "").slice(0, 500) || null,
    };
}

async function getLinker(app: FastifyInstance, req: FastifyRequest) {
    const uid = memberUid(req);
    if (!uid) return null;
    return app.prisma.zpzp_linker.findFirst({
        where: { member_uid: uid, status: "active" },
    });
}

export async function getLinkerSlotPolicy(
    app: FastifyInstance,
    linker: { uid: number; member_uid: number }
) {
    const yearMonth = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
    const [lookupTypeSetting, activePolicies] = await Promise.all([
        app.prisma.zpzp_setting.findUnique({
            where: { name: "linker_grade_lookup_type" },
        }),
        app.prisma.zpzp_linker_grade_policy.findMany({
            where: { is_active: true },
            orderBy: [{ crew_min: "asc" }, { sort: "asc" }, { uid: "asc" }],
        }),
    ]);
    const gradeLookupType = lookupTypeSetting?.value === "2" ? 2 : 1;
    const defaultPolicy = activePolicies[0] ?? null;
    const policyByCode = new Map(activePolicies.map((policy) => [policy.grade_code, policy]));

    const gradeSnapshot = gradeLookupType === 1
        ? await app.prisma.zpzp_linker_grade.findFirst({
            where: { linker_id: linker.uid, year_month: { lte: yearMonth } },
            orderBy: [{ year_month: "desc" }, { uid: "desc" }],
        })
        : (
            await app.prisma.zpzp_linker_grade.findUnique({
                where: {
                    linker_id_year_month: {
                        linker_id: linker.uid,
                        year_month: yearMonth,
                    },
                },
            })
            ?? await app.prisma.zpzp_linker_grade.findFirst({
                where: { linker_id: linker.uid, year_month: { lt: yearMonth } },
                orderBy: [{ year_month: "desc" }, { uid: "desc" }],
            })
        );

    const snapshotPolicy = gradeSnapshot
        ? policyByCode.get(gradeSnapshot.grade_code) ?? null
        : null;
    const useSnapshotValues = Boolean(
        gradeSnapshot
        && (gradeLookupType === 1 || gradeSnapshot.year_month === yearMonth)
    );
    const effectivePolicy = snapshotPolicy ?? defaultPolicy;
    const gradeCode = gradeSnapshot?.grade_code || effectivePolicy?.grade_code || "기본";
    const gradeTitle = effectivePolicy?.title || gradeCode;
    const slotLimitRaw = useSnapshotValues
        ? Number(gradeSnapshot?.slot_count ?? DEFAULT_SLOT_LIMIT)
        : Number(effectivePolicy?.slot_count ?? DEFAULT_SLOT_LIMIT);
    const commissionRate = useSnapshotValues
        ? Number(gradeSnapshot?.commission_rate ?? 0)
        : Number(effectivePolicy?.commission_rate ?? 0);

    return {
        gradeCode,
        gradeTitle,
        gradeLookupType,
        gradeYearMonth: gradeSnapshot?.year_month ?? null,
        commissionRate,
        slotLimit: Number.isInteger(slotLimitRaw) && slotLimitRaw >= 0
            ? slotLimitRaw
            : DEFAULT_SLOT_LIMIT,
    };
}

async function getSelectedState(app: FastifyInstance, linkerUid: number) {
    const selections = await app.prisma.mallRN_linker_products.findMany({
        where: { linker_uid: linkerUid, selection_status: "selected" },
        orderBy: [{ display_order: "asc" }, { selected_at: "desc" }],
    });
    const products = selections.length
        ? await app.prisma.mallRN_goods.findMany({
            where: { uid: { in: selections.map((row) => row.product_uid) } },
        })
        : [];
    const productMap = new Map(products.map((row) => [row.uid, row]));
    const slotUsed = selections.reduce((sum, row) => {
        const product = productMap.get(row.product_uid);
        return sum + (product && isSelling(product) ? 1 : 0);
    }, 0);
    return { selections, productMap, slotUsed };
}

function productDto(product: any, selection?: any, sales?: { order_count: bigint; sale_qty: bigint }) {
    const selling = isSelling(product);
    return {
        id: String(product.uid),
        name: String(product.name ?? ""),
        category: String(product.cate ?? ""),
        price: Number(product.price ?? 0),
        stock: Number(product.qty ?? 0),
        image: imageUrl(product.image1),
        productStatus: selling ? (Number(product.qty_type) === 0 && Number(product.qty) <= 0 ? "품절" : "판매 중") : "판매 중지",
        slotCounted: selling,
        selectedAt: selection?.selected_at?.toISOString?.() ?? null,
        displayStatus: selection?.display_status ?? "visible",
        displayOrder: Number(selection?.display_order ?? 0),
        selectionUid: selection ? String(selection.uid) : null,
        canRegister: selling,
        unavailableReason: selling ? null : "판매가 중지되어 등록할 수 없습니다.",
        salesCount: Number(sales?.order_count ?? 0),
        salesQuantity: Number(sales?.sale_qty ?? 0),
    };
}

export async function sellerLinkerProductsRoutes(app: FastifyInstance) {
    app.get("/v1/seller/linker-products", { preHandler: requireTenant() }, async (req, reply) => {
        const linker = await getLinker(app, req);
        if (!linker) return reply.code(403).send({ ok: false, message: "활성 링커 계정이 필요합니다." });

        const query = z.object({
            selectedQ: z.string().default(""),
            availableQ: z.string().default(""),
            selectedPage: z.coerce.number().int().min(1).default(1),
            availablePage: z.coerce.number().int().min(1).default(1),
            // 클라이언트가 예전 pageSize를 보내더라도 서버에서는 항상 5개씩 조회한다.
            pageSize: z.coerce.number().int().optional(),
        }).parse(req.query);
        const pageSize = 5;

        const policy = await getLinkerSlotPolicy(app, linker);
        const state = await getSelectedState(app, linker.uid);
        const selectedIds = new Set(state.selections.map((row) => row.product_uid));
        const salesRows = state.selections.length
            ? await app.prisma.$queryRaw<Array<{ g_uid: number; order_count: bigint; sale_qty: bigint }>>(Prisma.sql`
                SELECT og.g_uid,
                       COUNT(DISTINCT og.order_num) AS order_count,
                       COALESCE(SUM(og.qty), 0) AS sale_qty
                  FROM mallRN_order_goods og
                  JOIN mallRN_order_info oi ON oi.order_num = og.order_num
                  JOIN zpzp_referral_attribution ra ON ra.member_uid = oi.member_uid
                 WHERE ra.linker_id = ${linker.uid}
                   AND oi.pay_status <> 'A'
                   AND og.g_uid IN (${Prisma.join(state.selections.map((row) => row.product_uid))})
                 GROUP BY og.g_uid
            `)
            : [];
        const salesMap = new Map(salesRows.map((row) => [row.g_uid, row]));

        const selectedKeyword = query.selectedQ.trim().toLowerCase();
        const availableKeyword = query.availableQ.trim();
        const selectedItems = state.selections
            .map((selection) => {
                const product = state.productMap.get(selection.product_uid);
                return product ? productDto(product, selection, salesMap.get(product.uid)) : null;
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
            .filter((item) => item.slotCounted || item.salesCount > 0)
            .filter((item) => !selectedKeyword || item.name.toLowerCase().includes(selectedKeyword) || item.id.includes(selectedKeyword));
        const availableWhere = availableGoodsWhere([...selectedIds], availableKeyword);
        const availableSkip = (query.availablePage - 1) * pageSize;
        const [availableTotal, availableProducts] = await Promise.all([
            app.prisma.mallRN_goods.count({ where: availableWhere }),
            app.prisma.mallRN_goods.findMany({
                where: availableWhere,
                orderBy: [{ sort_order: "desc" }, { uid: "desc" }],
                skip: availableSkip,
                take: pageSize,
            }),
        ]);
        const availableItems = availableProducts.map((product) => productDto(product));

        const selectedStopped = selectedItems.filter((item) => !item.slotCounted).length;
        const selectedStart = (query.selectedPage - 1) * pageSize;
        const selectedPageItems = selectedItems.slice(selectedStart, selectedStart + pageSize);
        return reply.send({
            ok: true,
            linker: { uid: linker.uid, shopSlug: linker.shop_slug, shopName: linker.shop_name },
            summary: {
                grade: policy.gradeCode,
                gradeTitle: policy.gradeTitle,
                gradeLookupType: policy.gradeLookupType,
                gradeYearMonth: policy.gradeYearMonth,
                commissionRate: policy.commissionRate,
                slotLimit: policy.slotLimit,
                slotUsed: state.slotUsed,
                slotRemaining: Math.max(0, policy.slotLimit - state.slotUsed),
                slotExceeded: Math.max(0, state.slotUsed - policy.slotLimit),
                selectedTotal: selectedItems.length,
                stoppedTotal: selectedStopped,
                registrationBlocked: state.slotUsed >= policy.slotLimit,
            },
            selected: {
                items: selectedPageItems,
                allIds: selectedPageItems.map((item) => item.id),
                total: selectedItems.length,
                page: query.selectedPage,
                pageSize,
            },
            available: {
                items: availableItems,
                // 전체 4만여 개 ID를 응답하지 않고 현재 페이지 5개만 전달한다.
                allIds: availableItems.map((item) => item.id),
                total: availableTotal,
                page: query.availablePage,
                pageSize,
            },
        });
    });

    app.post("/v1/seller/linker-products/select", { preHandler: requireTenant() }, async (req, reply) => {
        const actorUid = memberUid(req);
        const linker = await getLinker(app, req);
        if (!linker) return reply.code(403).send({ ok: false, message: "활성 링커 계정이 필요합니다." });
        const body = z.object({
            productIds: z.array(z.coerce.number().int().positive()).max(1000).default([]),
            scope: z.enum(["single", "selected", "filtered_all"]).default("selected"),
            availableQ: z.string().max(200).default(""),
        }).parse(req.body);
        const policy = await getLinkerSlotPolicy(app, linker);
        let productIds = [...new Set(body.productIds)];
        if (body.scope === "filtered_all") {
            const state = await getSelectedState(app, linker.uid);
            const remaining = Math.max(0, policy.slotLimit - state.slotUsed);
            const where = availableGoodsWhere(
                state.selections.map((row) => row.product_uid),
                body.availableQ
            );
            const total = await app.prisma.mallRN_goods.count({ where });
            if (total === 0) {
                return reply.code(400).send({ ok: false, message: "현재 검색조건에 등록 가능한 상품이 없습니다." });
            }
            if (total > MAX_FILTERED_ALL_RESULTS) {
                return reply.code(409).send({
                    ok: false,
                    message: `검색 결과가 ${MAX_FILTERED_ALL_RESULTS.toLocaleString("ko-KR")}개를 초과하여 전체 등록할 수 없습니다. 검색조건을 더 구체적으로 입력해 주세요.`,
                });
            }
            if (total > remaining) {
                return reply.code(409).send({
                    ok: false,
                    message: `검색 결과는 ${total}개이고 남은 슬롯은 ${remaining}개입니다. 전체 등록할 수 없습니다.`,
                });
            }
            const rows = await app.prisma.mallRN_goods.findMany({
                where,
                orderBy: [{ sort_order: "desc" }, { uid: "desc" }],
                select: { uid: true },
                take: Math.min(1000, remaining),
            });
            productIds = rows.map((row) => row.uid);
        }
        if (productIds.length === 0) {
            return reply.code(400).send({ ok: false, message: "등록할 상품을 선택해 주세요." });
        }
        const requestId = randomUUID();

        try {
            const result = await app.prisma.$transaction(async (tx) => {
                const selected = await tx.mallRN_linker_products.findMany({
                    where: { linker_uid: linker.uid, selection_status: "selected" },
                });
                const selectedProducts = selected.length ? await tx.mallRN_goods.findMany({ where: { uid: { in: selected.map((row) => row.product_uid) } } }) : [];
                const usedBefore = selectedProducts.filter(isSelling).length;
                if (usedBefore > policy.slotLimit) throw new Error("SLOT_EXCEEDED");
                const existingIds = new Set(selected.map((row) => row.product_uid));
                const products = await tx.mallRN_goods.findMany({ where: { uid: { in: productIds }, tenant_id: HQ_TENANT_ID } });
                const valid = products.filter((row) => isSelling(row) && !existingIds.has(row.uid));
                if (valid.length !== productIds.length) throw new Error("INVALID_PRODUCT");
                if (usedBefore + valid.length > policy.slotLimit) throw new Error("SLOT_SHORTAGE");
                let nextOrder = selected.reduce((max, row) => Math.max(max, row.display_order), 0) + 1;
                for (const product of valid) {
                    const previous = await tx.mallRN_linker_products.findUnique({
                        where: { linker_uid_product_uid: { linker_uid: linker.uid, product_uid: product.uid } },
                    });
                    const row = await tx.mallRN_linker_products.upsert({
                        where: { linker_uid_product_uid: { linker_uid: linker.uid, product_uid: product.uid } },
                        create: {
                            linker_uid: linker.uid, product_uid: product.uid, display_order: nextOrder++,
                            product_status_snapshot: product.status, selected_by: actorUid,
                            last_status_checked_at: new Date(),
                        },
                        update: {
                            selection_status: "selected", display_status: "visible", display_order: nextOrder++,
                            product_status_snapshot: product.status, selected_at: new Date(), selected_by: actorUid,
                            removed_at: null, removed_by: null, remove_reason: null, last_status_checked_at: new Date(),
                        },
                    });
                    await tx.mallRN_linker_product_logs.create({
                        data: {
                            linker_uid: linker.uid, product_uid: product.uid, linker_product_uid: row.uid,
                            action_type: previous ? "PRODUCT_RESTORED" : "PRODUCT_ADDED", action_scope: body.scope,
                            previous_value: previous ? { selectionStatus: previous.selection_status } : undefined,
                            changed_value: { selectionStatus: "selected", displayStatus: "visible" },
                            slot_limit_snapshot: policy.slotLimit, slot_used_before: usedBefore,
                            slot_used_after: usedBefore + valid.length, product_status_snapshot: product.status,
                            request_id: requestId, actor_uid: actorUid, ...requestMeta(req),
                        }
                    });
                }
                return { count: valid.length, slotUsed: usedBefore + valid.length };
            }, { isolationLevel: "Serializable" });
            return reply.send({ ok: true, ...result, requestId });
        } catch (error) {
            const code = error instanceof Error ? error.message : "UNKNOWN";
            const message = code === "SLOT_EXCEEDED"
                ? "현재 등급의 슬롯 수를 초과하여 신규 상품을 등록할 수 없습니다."
                : code === "SLOT_SHORTAGE"
                    ? "선택한 상품 수가 남은 슬롯보다 많습니다."
                    : code === "INVALID_PRODUCT"
                        ? "이미 등록됐거나 판매가 중지된 상품이 포함되어 있습니다."
                        : "슬롯 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.";
            return reply.code(code === "UNKNOWN" ? 500 : 409).send({ ok: false, message });
        }
    });

    app.delete("/v1/seller/linker-products/select", { preHandler: requireTenant() }, async (req, reply) => {
        const actorUid = memberUid(req);
        const linker = await getLinker(app, req);
        if (!linker) return reply.code(403).send({ ok: false, message: "활성 링커 계정이 필요합니다." });
        const body = z.object({
            productIds: z.array(z.coerce.number().int().positive()).max(1000).default([]),
            scope: z.enum(["single", "selected", "filtered_all"]).default("selected"),
            selectedQ: z.string().max(200).default(""),
            reason: z.string().max(255).default("링커 상품 관리에서 삭제"),
        }).parse(req.body);
        let productIds = [...new Set(body.productIds)];
        const policy = await getLinkerSlotPolicy(app, linker);
        const before = await getSelectedState(app, linker.uid);
        if (body.scope === "filtered_all") {
            const keyword = body.selectedQ.trim().toLowerCase();
            productIds = before.selections
                .filter((selection) => {
                    const product = before.productMap.get(selection.product_uid);
                    if (!product) return false;
                    return !keyword
                        || String(product.name ?? "").toLowerCase().includes(keyword)
                        || String(product.uid).includes(keyword);
                })
                .map((selection) => selection.product_uid);
        }
        if (productIds.length === 0) {
            return reply.code(400).send({ ok: false, message: "삭제할 상품이 없습니다." });
        }
        const requestId = randomUUID();
        const rows = await app.prisma.mallRN_linker_products.findMany({
            where: { linker_uid: linker.uid, product_uid: { in: productIds }, selection_status: "selected" },
        });
        const removedSlotCount = rows.reduce((count, row) => {
            const product = before.productMap.get(row.product_uid);
            return count + (product && isSelling(product) ? 1 : 0);
        }, 0);
        const slotUsedAfter = Math.max(0, before.slotUsed - removedSlotCount);
        await app.prisma.$transaction(async (tx) => {
            for (const row of rows) {
                await tx.mallRN_linker_products.update({
                    where: { uid: row.uid }, data: {
                        selection_status: "removed", removed_at: new Date(), removed_by: actorUid, remove_reason: body.reason,
                    }
                });
                await tx.mallRN_linker_product_logs.create({
                    data: {
                        linker_uid: linker.uid, product_uid: row.product_uid, linker_product_uid: row.uid,
                        action_type: "PRODUCT_REMOVED", action_scope: body.scope,
                        previous_value: { selectionStatus: "selected" }, changed_value: { selectionStatus: "removed" },
                        slot_limit_snapshot: policy.slotLimit, slot_used_before: before.slotUsed,
                        slot_used_after: slotUsedAfter, request_id: requestId,
                        actor_uid: actorUid, reason: body.reason, ...requestMeta(req),
                    }
                });
            }
        });
        return reply.send({ ok: true, count: rows.length, requestId });
    });

    app.patch("/v1/seller/linker-products/order", { preHandler: requireTenant() }, async (req, reply) => {
        const actorUid = memberUid(req);
        const linker = await getLinker(app, req);
        if (!linker) return reply.code(403).send({ ok: false, message: "활성 링커 계정이 필요합니다." });
        const body = z.object({
            items: z.array(z.object({
                productId: z.coerce.number().int().positive(),
                displayOrder: z.coerce.number().int().min(1),
                displayStatus: z.enum(["visible", "hidden"]).default("visible"),
            })).min(1).max(1000)
        }).parse(req.body);
        const policy = await getLinkerSlotPolicy(app, linker);
        const state = await getSelectedState(app, linker.uid);
        const requestId = randomUUID();
        const changedCount = await app.prisma.$transaction(async (tx) => {
            let count = 0;
            for (const item of body.items) {
                const current = await tx.mallRN_linker_products.findUnique({
                    where: { linker_uid_product_uid: { linker_uid: linker.uid, product_uid: item.productId } },
                });
                if (!current || current.selection_status !== "selected") continue;
                const orderChanged = current.display_order !== item.displayOrder;
                const statusChanged = current.display_status !== item.displayStatus;
                if (!orderChanged && !statusChanged) continue;
                await tx.mallRN_linker_products.update({
                    where: { uid: current.uid }, data: {
                        display_order: item.displayOrder, display_status: item.displayStatus,
                    }
                });
                const actionType = orderChanged && statusChanged
                    ? "DISPLAY_SETTINGS_CHANGED"
                    : statusChanged
                        ? "DISPLAY_STATUS_CHANGED"
                        : "DISPLAY_ORDER_CHANGED";
                await tx.mallRN_linker_product_logs.create({
                    data: {
                        linker_uid: linker.uid, product_uid: item.productId, linker_product_uid: current.uid,
                        action_type: actionType, action_scope: "selected",
                        previous_value: { displayOrder: current.display_order, displayStatus: current.display_status },
                        changed_value: { displayOrder: item.displayOrder, displayStatus: item.displayStatus },
                        slot_limit_snapshot: policy.slotLimit, slot_used_before: state.slotUsed, slot_used_after: state.slotUsed,
                        request_id: requestId, actor_uid: actorUid, ...requestMeta(req),
                    }
                });
                count += 1;
            }
            return count;
        });
        return reply.send({ ok: true, count: changedCount, requestId });
    });
}
