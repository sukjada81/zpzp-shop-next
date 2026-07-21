// apps/api/src/modules/seller/access-check.routes.ts
import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../common/guard.js";

const GLOBAL_ALLOWED_ROLES = ["hq_admin", "hq_staff", "hq_super"] as const;
const TENANT_SELLER_ROLES = ["seller_owner", "seller_staff"] as const;

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

export async function sellerAccessCheckRoutes(app: FastifyInstance) {
    app.get(
        "/v1/seller/access-check",
        { preHandler: requireTenant() },
        async (req: any, reply) => {
            const member = getSessionMember(req);
            if (!member?.uid) {
                return reply.code(401).send({ ok: false, message: "login required" });
            }

            const memberUid = toInt(member.uid, 0);
            if (memberUid <= 0) {
                return reply.code(401).send({ ok: false, message: "invalid session" });
            }

            const tenantId = req.tenantId as bigint;

            const memberRow = await app.prisma.mallRN_member.findFirst({
                where: { uid: memberUid, status: "active", deleted_at: null },
                select: { uid: true },
            });

            if (!memberRow) {
                return reply.code(403).send({ ok: false, message: "member not found" });
            }

            // 1. 글로벌 권한(본사 관리자)은 항상 active 처리
            // 여러 글로벌 역할이 있을 경우 hq_super > hq_admin > hq_staff 우선순위로 선택
            const globalRows = await app.prisma.mallRN_member_membership.findMany({
                where: {
                    member_uid: memberUid,
                    status: "active",
                    scope_type: "global",
                    role_code: { in: [...GLOBAL_ALLOWED_ROLES] },
                },
                select: { role_code: true },
            });

            if (globalRows.length > 0) {
                const ROLE_PRIORITY = ["hq_super", "hq_admin", "hq_staff"];
                const bestRole =
                    ROLE_PRIORITY.find((r) => globalRows.some((row) => row.role_code === r)) ??
                    String(globalRows[0].role_code ?? "");
                return reply.send({ ok: true, status: "active", role: bestRole });
            }

            // 활성 링커는 자신의 샵 상품관리 화면에 접근할 수 있다.
            // 주문/회원/매출 권한과 섞이지 않도록 별도 role을 반환한다.
            const linker = await app.prisma.zpzp_linker.findFirst({
                where: {
                    member_uid: memberUid,
                    status: "active",
                    OR: [
                        { tenant_id: tenantId },
                        { shop_slug: String(req.tenantSlug ?? "") },
                    ],
                },
                select: { uid: true },
            });

            if (linker) {
                return reply.send({ ok: true, status: "active", role: "linker" });
            }

            // 2. 지점 셀러 멤버십 조회 (status 무관)
            const tenantMs = await app.prisma.mallRN_member_membership.findFirst({
                where: {
                    member_uid: memberUid,
                    scope_type: "tenant",
                    scope_id: tenantId,
                    role_code: { in: [...TENANT_SELLER_ROLES] },
                },
                select: { uid: true, status: true, role_code: true },
            });

            if (tenantMs) {
                const currentStatus = String(tenantMs.status ?? "").trim();

                if (currentStatus === "active") {
                    return reply.send({
                        ok: true,
                        status: "active",
                        role: String(tenantMs.role_code ?? ""),
                    });
                }

                // rejected → pending 복원 (Phase E 포함)
                if (currentStatus === "rejected") {
                    await app.prisma.mallRN_member_membership.update({
                        where: { uid: tenantMs.uid },
                        data: { status: "pending" },
                    });
                    return reply.send({ ok: true, status: "pending" });
                }

                // pending 또는 기타
                return reply.send({ ok: true, status: currentStatus });
            }

            // 3. 멤버십 없음 → pending 자동 생성
            await app.prisma.mallRN_member_membership.create({
                data: {
                    member_uid: memberUid,
                    role_code: "seller_owner",
                    scope_type: "tenant",
                    scope_id: tenantId,
                    status: "pending",
                    is_primary: false,
                    joined_at: new Date(),
                },
            });

            return reply.send({ ok: true, status: "pending" });
        }
    );
}
