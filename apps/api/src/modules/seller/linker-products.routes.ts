import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireTenant } from "../../common/guard.js";

const HQ_TENANT_ID = BigInt(0);
const DEFAULT_SLOT_LIMIT = 20;

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
        row.status === "active" &&
        row.sale_use === 1 &&
        row.deleted_at == null &&
        (!row.sale_end_at || row.sale_end_at.getTime() >= Date.now())
    );
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

async function getSlotPolicy(app: FastifyInstance, linker: { member_uid: number }) {
    const member = await app.prisma.mallRN_member.findUnique({
        where: { uid: linker.member_uid },
        select: { id: true },
    });
    const yearMonth = new Date().toISOString().slice(0, 7);
    const grade = member
        ? await app.prisma.mallRN_member_grade.findUnique({
              where: { member_id_year_month: { member_id: member.id, year_month: yearMonth } },
          })
        : null;
    const gradeCode = grade?.grade_code || "기본";
    const settingNames = [
        `linker_slot_${gradeCode.toLowerCase()}`,
        "linker_slot_default",
    ];
    const settings = await app.prisma.zpzp_setting.findMany({ where: { name: { in: settingNames } } });
    const byName = new Map(settings.map((row) => [row.name, row.value]));
    const raw = byName.get(settingNames[0]) ?? byName.get("linker_slot_default");
    const parsed = Number(raw ?? DEFAULT_SLOT_LIMIT);
    return {
        gradeCode,
        slotLimit: Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_SLOT_LIMIT,
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
    app.addHook("preHandler", requireTenant());

    app.get("/v1/seller/linker-products", async (req, reply) => {
        const linker = await getLinker(app, req);
        if (!linker) return reply.code(403).send({ ok: false, message: "활성 링커 계정이 필요합니다." });

        const query = z.object({
            selectedQ: z.string().default(""),
            availableQ: z.string().default(""),
            selectedPage: z.coerce.number().int().min(1).default(1),
            availablePage: z.coerce.number().int().min(1).default(1),
            pageSize: z.coerce.number().int().min(10).max(100).default(20),
        }).parse(req.query);

        const policy = await getSlotPolicy(app, linker);
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

        const availableProducts = await app.prisma.mallRN_goods.findMany({
            where: {
                tenant_id: HQ_TENANT_ID,
                status: "active",
                sale_use: 1,
                auth_ck: "Y",
                deleted_at: null,
            },
            orderBy: [{ sort_order: "desc" }, { uid: "desc" }],
        });

        const selectedKeyword = query.selectedQ.trim().toLowerCase();
        const availableKeyword = query.availableQ.trim().toLowerCase();
        const selectedItems = state.selections
            .map((selection) => {
                const product = state.productMap.get(selection.product_uid);
                return product ? productDto(product, selection, salesMap.get(product.uid)) : null;
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
            .filter((item) => item.slotCounted || item.salesCount > 0)
            .filter((item) => !selectedKeyword || item.name.toLowerCase().includes(selectedKeyword) || item.id.includes(selectedKeyword));
        const availableItems = availableProducts
            .filter((product) => !selectedIds.has(product.uid) && isSelling(product))
            .map((product) => productDto(product))
            .filter((item) => !availableKeyword || item.name.toLowerCase().includes(availableKeyword) || item.id.includes(availableKeyword));

        const selectedStopped = selectedItems.filter((item) => !item.slotCounted).length;
        const selectedStart = (query.selectedPage - 1) * query.pageSize;
        const availableStart = (query.availablePage - 1) * query.pageSize;
        return reply.send({
            ok: true,
            linker: { uid: linker.uid, shopSlug: linker.shop_slug, shopName: linker.shop_name },
            summary: {
                grade: policy.gradeCode,
                slotLimit: policy.slotLimit,
                slotUsed: state.slotUsed,
                slotRemaining: Math.max(0, policy.slotLimit - state.slotUsed),
                slotExceeded: Math.max(0, state.slotUsed - policy.slotLimit),
                selectedTotal: selectedItems.length,
                stoppedTotal: selectedStopped,
                registrationBlocked: state.slotUsed >= policy.slotLimit,
            },
            selected: {
                items: selectedItems.slice(selectedStart, selectedStart + query.pageSize),
                allIds: selectedItems.map((item) => item.id),
                total: selectedItems.length,
                page: query.selectedPage,
                pageSize: query.pageSize,
            },
            available: {
                items: availableItems.slice(availableStart, availableStart + query.pageSize),
                allIds: availableItems.map((item) => item.id),
                total: availableItems.length,
                page: query.availablePage,
                pageSize: query.pageSize,
            },
        });
    });

    app.post("/v1/seller/linker-products/select", async (req, reply) => {
        const actorUid = memberUid(req);
        const linker = await getLinker(app, req);
        if (!linker) return reply.code(403).send({ ok: false, message: "활성 링커 계정이 필요합니다." });
        const body = z.object({
            productIds: z.array(z.coerce.number().int().positive()).min(1).max(1000),
            scope: z.enum(["single", "selected", "filtered_all"]).default("selected"),
        }).parse(req.body);
        const productIds = [...new Set(body.productIds)];
        const policy = await getSlotPolicy(app, linker);
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
                    await tx.mallRN_linker_product_logs.create({ data: {
                        linker_uid: linker.uid, product_uid: product.uid, linker_product_uid: row.uid,
                        action_type: previous ? "PRODUCT_RESTORED" : "PRODUCT_ADDED", action_scope: body.scope,
                        previous_value: previous ? { selectionStatus: previous.selection_status } : undefined,
                        changed_value: { selectionStatus: "selected", displayStatus: "visible" },
                        slot_limit_snapshot: policy.slotLimit, slot_used_before: usedBefore,
                        slot_used_after: usedBefore + valid.length, product_status_snapshot: product.status,
                        request_id: requestId, actor_uid: actorUid, ...requestMeta(req),
                    }});
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

    app.delete("/v1/seller/linker-products/select", async (req, reply) => {
        const actorUid = memberUid(req);
        const linker = await getLinker(app, req);
        if (!linker) return reply.code(403).send({ ok: false, message: "활성 링커 계정이 필요합니다." });
        const body = z.object({
            productIds: z.array(z.coerce.number().int().positive()).min(1).max(1000),
            scope: z.enum(["single", "selected", "filtered_all"]).default("selected"),
            reason: z.string().max(255).default("링커 상품 관리에서 삭제"),
        }).parse(req.body);
        const productIds = [...new Set(body.productIds)];
        const policy = await getSlotPolicy(app, linker);
        const before = await getSelectedState(app, linker.uid);
        const requestId = randomUUID();
        const rows = await app.prisma.mallRN_linker_products.findMany({
            where: { linker_uid: linker.uid, product_uid: { in: productIds }, selection_status: "selected" },
        });
        await app.prisma.$transaction(async (tx) => {
            for (const row of rows) {
                await tx.mallRN_linker_products.update({ where: { uid: row.uid }, data: {
                    selection_status: "removed", removed_at: new Date(), removed_by: actorUid, remove_reason: body.reason,
                }});
                await tx.mallRN_linker_product_logs.create({ data: {
                    linker_uid: linker.uid, product_uid: row.product_uid, linker_product_uid: row.uid,
                    action_type: "PRODUCT_REMOVED", action_scope: body.scope,
                    previous_value: { selectionStatus: "selected" }, changed_value: { selectionStatus: "removed" },
                    slot_limit_snapshot: policy.slotLimit, slot_used_before: before.slotUsed,
                    slot_used_after: Math.max(0, before.slotUsed - rows.length), request_id: requestId,
                    actor_uid: actorUid, reason: body.reason, ...requestMeta(req),
                }});
            }
        });
        return reply.send({ ok: true, count: rows.length, requestId });
    });

    app.patch("/v1/seller/linker-products/order", async (req, reply) => {
        const actorUid = memberUid(req);
        const linker = await getLinker(app, req);
        if (!linker) return reply.code(403).send({ ok: false, message: "활성 링커 계정이 필요합니다." });
        const body = z.object({ items: z.array(z.object({
            productId: z.coerce.number().int().positive(),
            displayOrder: z.coerce.number().int().min(1),
            displayStatus: z.enum(["visible", "hidden"]).default("visible"),
        })).min(1).max(1000) }).parse(req.body);
        const normalized = [...body.items].sort((a, b) => a.displayOrder - b.displayOrder);
        const policy = await getSlotPolicy(app, linker);
        const state = await getSelectedState(app, linker.uid);
        const requestId = randomUUID();
        await app.prisma.$transaction(async (tx) => {
            for (let index = 0; index < normalized.length; index += 1) {
                const item = normalized[index];
                const current = await tx.mallRN_linker_products.findUnique({
                    where: { linker_uid_product_uid: { linker_uid: linker.uid, product_uid: item.productId } },
                });
                if (!current || current.selection_status !== "selected") continue;
                await tx.mallRN_linker_products.update({ where: { uid: current.uid }, data: {
                    display_order: index + 1, display_status: item.displayStatus,
                }});
                await tx.mallRN_linker_product_logs.create({ data: {
                    linker_uid: linker.uid, product_uid: item.productId, linker_product_uid: current.uid,
                    action_type: "DISPLAY_ORDER_CHANGED", action_scope: "selected",
                    previous_value: { displayOrder: current.display_order, displayStatus: current.display_status },
                    changed_value: { displayOrder: index + 1, displayStatus: item.displayStatus },
                    slot_limit_snapshot: policy.slotLimit, slot_used_before: state.slotUsed, slot_used_after: state.slotUsed,
                    request_id: requestId, actor_uid: actorUid, ...requestMeta(req),
                }});
            }
        });
        return reply.send({ ok: true, count: normalized.length, requestId });
    });
}
