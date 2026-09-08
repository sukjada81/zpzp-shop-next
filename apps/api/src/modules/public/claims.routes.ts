import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { buildGoodsStatusLabel } from "../../lib/order/customer-order-display.js";
import {
    canWithdrawClaim,
    findClaimReason,
    loadClaimPolicySettings,
    parseClaimMessage,
    serializeClaimPolicy,
} from "../../lib/order/claim-policy.js";
import { compressClaimPhotoBuffer } from "../../lib/claim-photo-compress.js";

const PLATFORM_TYPE = "DAD";

function toInt(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toSafeString(value: unknown, fallback = ""): string {
    const text = String(value ?? "").trim();
    return text || fallback;
}

function parseClaimCause(reason: unknown): "change_of_mind" | "defect" | "unknown" {
    const text = String(reason ?? "");
    if (/\[변심\]/.test(text) || /변심/.test(text)) return "change_of_mind";
    if (/\[하자\]/.test(text) || /하자|오배송|파손|불량/.test(text)) return "defect";
    return "unknown";
}

function extractAuthenticatedMemberUid(request: FastifyRequest): bigint | null {
    const session = (request as FastifyRequest & { session?: { member?: { uid?: unknown; member_uid?: unknown } } }).session;
    const raw = session?.member?.uid ?? session?.member?.member_uid;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? BigInt(Math.trunc(n)) : null;
}

function getTenantId(request: FastifyRequest): bigint | null {
    const ctx = request as FastifyRequest & { tenantId?: bigint | number | string };
    const n = Number(ctx.tenantId);
    return Number.isFinite(n) && n > 0 ? BigInt(Math.trunc(n)) : null;
}

export async function publicClaimRoutes(fastify: FastifyInstance) {
    const prisma = fastify.prisma;

    fastify.get("/v1/claims/policy", async (request, reply: FastifyReply) => {
        const settings = await loadClaimPolicySettings(prisma);
        return reply.send({ ok: true, policy: serializeClaimPolicy(settings) });
    });

    fastify.post("/v1/claims/photos", async (request, reply: FastifyReply) => {
        const memberUid = extractAuthenticatedMemberUid(request);
        if (!memberUid) {
            return reply.code(401).send({ ok: false, message: "로그인이 필요합니다." });
        }
        const data = await request.file();
        if (!data) {
            return reply.code(400).send({ ok: false, message: "사진 파일이 필요합니다." });
        }
        const mime = String(data.mimetype || "");
        if (!mime.startsWith("image/")) {
            return reply.code(400).send({ ok: false, message: "이미지 파일만 올릴 수 있습니다." });
        }
        const raw = await data.toBuffer();
        if (raw.length > 8 * 1024 * 1024) {
            return reply.code(400).send({ ok: false, message: "사진은 8MB 이하만 올릴 수 있습니다." });
        }
        const packed = await compressClaimPhotoBuffer(raw);
        const buf = packed.buf;
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const uploadDir = path.join(process.cwd(), "uploads", "claims", String(yyyy), mm);
        fs.mkdirSync(uploadDir, { recursive: true });
        const ext = packed.ext || path.extname(data.filename || "") || ".jpg";
        const filename = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;
        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, buf);
        const phpDir = path.join("/var/www/shop-php", "uploads", "claims", String(yyyy), mm);
        try {
            fs.mkdirSync(phpDir, { recursive: true });
            fs.writeFileSync(path.join(phpDir, filename), buf);
        } catch {
            /* 본사 미리보기용 복사 실패해도 업로드 자체는 유지 */
        }
        const relative = `uploads/claims/${yyyy}/${mm}/${filename}`;
        return reply.send({ ok: true, path: relative, url: `/${relative}` });
    });

    fastify.get("/v1/claims", async (request, reply: FastifyReply) => {
        const memberUid = extractAuthenticatedMemberUid(request);
        if (!memberUid) {
            return reply.code(401).send({ ok: false, message: "로그인이 필요합니다." });
        }
        const tenantId = getTenantId(request);
        const orders = await prisma.mallRN_order_info.findMany({
            where: {
                member_uid: memberUid,
                platform_type: PLATFORM_TYPE,
                reals: 1,
                ...(tenantId ? { tenant_id: tenantId } : {}),
            },
            select: { order_num: true },
            take: 80,
            orderBy: { uid: "desc" },
        });
        const orderNums = orders.map((row) => row.order_num).filter(Boolean);
        if (!orderNums.length) {
            return reply.send({ ok: true, items: [] });
        }
        const rows = await prisma.mallRN_order_status_change.findMany({
            where: { order_num: { in: orderNums }, status: { in: [7, 8] } },
            orderBy: { uid: "desc" },
            take: 80,
        });
        const goodsUids = rows.map((row) => row.og_uid).filter((uid) => uid > 0);
        const goods = goodsUids.length
            ? await prisma.mallRN_order_goods.findMany({
                  where: { uid: { in: goodsUids } },
                  select: { uid: true, g_name: true, option_name: true, status: true, status2: true },
              })
            : [];
        const goodsMap = new Map(goods.map((row) => [row.uid, row]));
        const settings = await loadClaimPolicySettings(prisma);
        const items = rows.map((row) => {
            const meta = parseClaimMessage(row.message);
            const cause = parseClaimCause(row.reason);
            const reasonItem = findClaimReason(meta.code);
            const g = goodsMap.get(row.og_uid);
            const status = toInt(g?.status ?? row.status, 0);
            const status2 = toInt(g?.status2 ?? row.status2, 0);
            return {
                uid: row.uid,
                orderNum: row.order_num,
                orderGoodsUid: row.og_uid,
                title: toSafeString(g?.g_name, "주문 상품"),
                optionName: toSafeString(g?.option_name, ""),
                kind: row.status === 7 ? "exchange" : "return",
                cause,
                reasonLabel: reasonItem?.label || toSafeString(row.reason, ""),
                status,
                status2,
                statusLabel: buildGoodsStatusLabel(status, status2),
                photos: meta.photos,
                detail: meta.detail,
                canWithdraw: canWithdrawClaim({
                    status,
                    status2,
                    cause,
                    withdrawUntil: settings.withdrawUntil,
                }),
                createdAt: row.signdate ? new Date(row.signdate * 1000).toISOString() : null,
            };
        });
        return reply.send({ ok: true, items });
    });

    fastify.get("/v1/claims/:uid", async (request, reply: FastifyReply) => {
        const memberUid = extractAuthenticatedMemberUid(request);
        if (!memberUid) {
            return reply.code(401).send({ ok: false, message: "로그인이 필요합니다." });
        }
        const uid = toInt((request.params as { uid?: string }).uid, 0);
        const row = await prisma.mallRN_order_status_change.findFirst({ where: { uid } });
        if (!row) {
            return reply.code(404).send({ ok: false, message: "신청 내역이 없습니다." });
        }
        const order = await prisma.mallRN_order_info.findFirst({
            where: { order_num: row.order_num, member_uid: memberUid, reals: 1 },
            select: { order_num: true },
        });
        if (!order) {
            return reply.code(404).send({ ok: false, message: "신청 내역이 없습니다." });
        }
        const goods = await prisma.mallRN_order_goods.findFirst({
            where: { uid: row.og_uid },
            select: { uid: true, g_name: true, option_name: true, status: true, status2: true, price: true, qty: true },
        });
        const meta = parseClaimMessage(row.message);
        const cause = parseClaimCause(row.reason);
        const settings = await loadClaimPolicySettings(prisma);
        const status = toInt(goods?.status ?? row.status, 0);
        const status2 = toInt(goods?.status2 ?? row.status2, 0);
        return reply.send({
            ok: true,
            item: {
                uid: row.uid,
                orderNum: row.order_num,
                orderGoodsUid: row.og_uid,
                title: toSafeString(goods?.g_name, "주문 상품"),
                optionName: toSafeString(goods?.option_name, ""),
                kind: row.status === 7 ? "exchange" : "return",
                cause,
                reasonLabel: findClaimReason(meta.code)?.label || toSafeString(row.reason, ""),
                status,
                status2,
                statusLabel: buildGoodsStatusLabel(status, status2),
                photos: meta.photos,
                detail: meta.detail,
                reason: row.reason,
                canWithdraw: canWithdrawClaim({
                    status,
                    status2,
                    cause,
                    withdrawUntil: settings.withdrawUntil,
                }),
                createdAt: row.signdate ? new Date(row.signdate * 1000).toISOString() : null,
            },
        });
    });
}
