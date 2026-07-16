// apps/api/src/modules/public/auth.routes.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { captureRefFromRequest } from "../attribution/capture";

console.log("AUTH_ROUTES_LOADED_20260316_DEBUG");

function onlyDigits(v: string) {
    return String(v || "").replace(/\D+/g, "");
}

function normalizePhone(v: string) {
    return onlyDigits(v);
}

function buildMemberLoginId(base: string) {
    const seed = String(base || "kakao")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${seed || "kakao"}_${suffix}`;
}

async function generateUniqueMemberId(app: FastifyInstance, preferred?: string) {
    for (let i = 0; i < 20; i += 1) {
        const candidate =
            i === 0 && preferred ? preferred : buildMemberLoginId(preferred || "kakao");

        const exists = await app.prisma.mallRN_member.findUnique({
            where: { id: candidate },
            select: { uid: true },
        });

        if (!exists) return candidate;
    }

    return `kakao_${Date.now()}`;
}

async function resolveTenantIdBySlug(app: FastifyInstance, tenantSlug: string) {
    const raw = String(tenantSlug || "");
    const slug = raw.trim().toLowerCase();

    console.log("KAKAO_COMPLETE_TENANT_SLUG_RAW", raw);
    console.log("KAKAO_COMPLETE_TENANT_SLUG_NORMALIZED", slug);

    const allTenants = await app.prisma.tenant.findMany({
        select: {
            id: true,
            slug: true,
            name: true,
            status: true,
        },
        orderBy: { id: "asc" },
        take: 20,
    });

    console.log("DEBUG_TENANTS_FROM_PRISMA", allTenants);

    let tenant = await app.prisma.tenant.findFirst({
        where: {
            slug,
            status: "active",
        },
        select: {
            id: true,
            slug: true,
            name: true,
            status: true,
        },
    });

    console.log("STEP1_STRICT_MATCH", tenant);

    if (!tenant) {
        tenant = await app.prisma.tenant.findFirst({
            where: { slug },
            select: {
                id: true,
                slug: true,
                name: true,
                status: true,
            },
        });

        console.log("STEP2_SLUG_ONLY_MATCH", tenant);
    }

    if (!tenant && allTenants.length > 0) {
        tenant =
            allTenants.find(
                (t: any) => String(t.slug || "").trim().toLowerCase() === slug
            ) || null;

        console.log("STEP3_IN_MEMORY_MATCH", tenant);
    }

    if (!tenant && allTenants.length > 0) {
        tenant = allTenants[0];
        console.log("STEP4_FALLBACK_FIRST_TENANT", tenant);
    }

    console.log("RESOLVE_TENANT_FINAL", tenant);

    if (!tenant) return null;

    return {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
    };
}

function nowUnix() {
    return Math.floor(Date.now() / 1000);
}

function errorToPlain(err: unknown) {
    if (err instanceof Error) {
        return {
            name: err.name,
            message: err.message,
            stack: err.stack,
        };
    }

    return {
        name: "UnknownError",
        message: String(err),
        stack: undefined,
    };
}

export async function publicAuthRoutes(app: FastifyInstance) {
    console.log("PUBLIC_AUTH_ROUTES_REGISTERED");

    app.post("/v1/auth/kakao/complete", async (req: any, reply) => {
        try {
            console.log("KAKAO_COMPLETE_ROUTE_HIT");
            console.log("KAKAO_COMPLETE_BODY", req.body);

            app.log.info(
                {
                    sessionMemberBefore: req.session?.member ?? null,
                    cookieHeader: req.headers.cookie ?? "",
                    protocol: req.protocol,
                    forwardedProto: req.headers["x-forwarded-proto"] ?? "",
                    host: req.headers.host ?? "",
                },
                "KAKAO_COMPLETE_SESSION_DEBUG_BEFORE"
            );

            const body = z
                .object({
                    tenantSlug: z.string().min(1),
                    providerUserId: z.string().min(1),
                    email: z.string().optional().default(""),
                    name: z.string().optional().default(""),
                    phone: z.string().optional().default(""),
                    profileImage: z.string().optional().default(""),
                    rawProfile: z.any().optional(),
                })
                .parse(req.body ?? {});

            const tenantSlug = String(body.tenantSlug || "").trim().toLowerCase();
            console.log("KAKAO_COMPLETE_TENANT_SLUG", tenantSlug);

            const tenant = await resolveTenantIdBySlug(app, tenantSlug);

            if (!tenant) {
                console.log("KAKAO_COMPLETE_TENANT_NOT_RESOLVED", { tenantSlug });

                return reply.code(400).send({
                    ok: false,
                    error: "TENANT_NOT_RESOLVED",
                    tenantSlug,
                });
            }

            const now = new Date();
            const nowTs = nowUnix();

            const phone = normalizePhone(body.phone || "");
            const email = String(body.email || "").trim().toLowerCase();
            const providerUserId = String(body.providerUserId || "").trim();
            const displayName = String(body.name || "").trim() || "카카오회원";
            const profileImage = String(body.profileImage || "").trim();

            let memberUid: number | null = null;

            const social = await app.prisma.mallRN_member_social_account.findUnique({
                where: {
                    provider_provider_user_id: {
                        provider: "kakao",
                        provider_user_id: providerUserId,
                    },
                },
                select: {
                    uid: true,
                    member_uid: true,
                },
            });

            console.log("KAKAO_SOCIAL_FOUND", social);

            if (social?.member_uid) {
                memberUid = Number(social.member_uid);
            }

            if (!memberUid && (email || phone)) {
                const existing = await app.prisma.mallRN_member.findFirst({
                    where: {
                        OR: [
                            ...(email ? [{ email }] : []),
                            ...(phone ? [{ cell: phone }] : []),
                        ],
                    },
                    select: { uid: true, id: true, name: true },
                });

                console.log("KAKAO_EXISTING_MEMBER_BY_EMAIL_OR_PHONE", existing);

                if (existing?.uid) {
                    memberUid = Number(existing.uid);
                }
            }

            if (!memberUid) {
                // [줍줍] 미가입 카카오 유저는 자동생성하지 않는다. (정책 2026-07-11)
                // 셀러/스토어프론트 서브도메인의 카카오 로그인은 신규 계정을 만들지 않고,
                // 본사(zpzp.kr) 카카오 간편가입으로 유도한다. Next 콜백이 NOT_REGISTERED를
                // 받아 본사 로그인/가입으로 302 리다이렉트한다.
                // (generateUniqueMemberId 헬퍼는 정책 복원 대비 남겨둠)
                console.log("KAKAO_NOT_REGISTERED", { providerUserId, email, phone });
                return reply.code(409).send({ ok: false, code: "NOT_REGISTERED" });
            } else {
                await app.prisma.mallRN_member.update({
                    where: { uid: memberUid },
                    data: {
                        // name(주문 프로필 닉네임)은 사용자가 설정에서 바꾸므로 재로그인 시 덮어쓰지 않는다.
                        // 카카오 닉네임은 sns_name 에만 최신값으로 반영한다.
                        email: email || undefined,
                        cell: phone || undefined,
                        sns_type: "kakao",
                        sns_id: providerUserId,
                        sns_name: displayName,
                        status: "active",
                        primary_role: "consumer",
                        last_selected_tenant_id: tenant.id,
                        last_login_at_dt: now,
                        login_time: nowTs,
                        updated_at_dt: now,
                    },
                });

                console.log("KAKAO_UPDATED_MEMBER_UID", memberUid);
            }

            await app.prisma.mallRN_member_social_account.upsert({
                where: {
                    provider_provider_user_id: {
                        provider: "kakao",
                        provider_user_id: providerUserId,
                    },
                },
                update: {
                    member_uid: memberUid,
                    provider_email: email,
                    provider_name: displayName,
                    provider_phone: phone,
                    provider_profile_image: profileImage,
                    last_login_at: now,
                    is_active: true,
                    raw_profile_json: body.rawProfile ?? null,
                    updated_at: now,
                },
                create: {
                    member_uid: memberUid,
                    provider: "kakao",
                    provider_user_id: providerUserId,
                    provider_email: email,
                    provider_name: displayName,
                    provider_phone: phone,
                    provider_profile_image: profileImage,
                    linked_at: now,
                    last_login_at: now,
                    is_active: true,
                    raw_profile_json: body.rawProfile ?? null,
                    created_at: now,
                    updated_at: now,
                },
            });

            console.log("KAKAO_SOCIAL_UPSERT_DONE", {
                memberUid,
                providerUserId,
            });

            await app.prisma.mallRN_member_membership.upsert({
                where: {
                    member_uid_role_code_scope_type_scope_id: {
                        member_uid: memberUid,
                        role_code: "consumer",
                        scope_type: "tenant",
                        scope_id: tenant.id,
                    },
                },
                update: {
                    status: "active",
                    is_primary: true,
                    left_at: null,
                    updated_at: now,
                },
                create: {
                    member_uid: memberUid,
                    role_code: "consumer",
                    scope_type: "tenant",
                    scope_id: tenant.id,
                    status: "active",
                    is_primary: true,
                    joined_at: now,
                    approved_at: now,
                    created_at: now,
                    updated_at: now,
                },
            });

            await captureRefFromRequest(app.prisma, memberUid, (req as any).cookies ?? {});

            console.log("KAKAO_MEMBERSHIP_UPSERT_DONE", {
                memberUid,
                tenantId: String(tenant.id),
                tenantSlug: tenant.slug,
            });

            const member = await app.prisma.mallRN_member.findUnique({
                where: { uid: memberUid },
                select: {
                    uid: true,
                    id: true,
                    name: true,
                    email: true,
                    cell: true,
                },
            });

            console.log("KAKAO_MEMBER_AFTER_FIND", member);

            req.session.member = {
                uid: Number(member?.uid ?? 0),
                id: String(member?.id ?? ""),
                name: String(member?.name ?? ""),
                email: String(member?.email ?? ""),
                phone: String(member?.cell ?? ""),
                provider: "kakao",
                tenantId: String(tenant.id),
                tenantSlug: tenant.slug,
            };

            app.log.info(
                {
                    sessionMemberAfterAssign: req.session?.member ?? null,
                },
                "KAKAO_COMPLETE_SESSION_DEBUG_AFTER_ASSIGN"
            );

            await req.session.save();

            app.log.info(
                {
                    sessionMemberAfterSave: req.session?.member ?? null,
                    setCookieHeader: reply.getHeader("set-cookie") ?? null,
                },
                "KAKAO_COMPLETE_SESSION_DEBUG_AFTER_SAVE"
            );

            console.log("KAKAO_SESSION_SAVED", req.session.member);

            return reply.send({
                ok: true,
                tenant: {
                    id: String(tenant.id),
                    slug: tenant.slug,
                    name: tenant.name ?? "",
                },
                member: {
                    uid: String(member?.uid ?? ""),
                    id: String(member?.id ?? ""),
                    name: String(member?.name ?? ""),
                    email: String(member?.email ?? ""),
                    phone: String(member?.cell ?? ""),
                },
            });
        } catch (err) {
            const plain = errorToPlain(err);

            console.error("KAKAO_COMPLETE_ERROR", plain);
            app.log.error(
                {
                    err: plain,
                    body: req.body ?? null,
                    host: req.headers.host ?? "",
                    forwardedProto: req.headers["x-forwarded-proto"] ?? "",
                    cookieHeader: req.headers.cookie ?? "",
                    sessionMember: req.session?.member ?? null,
                },
                "KAKAO_COMPLETE_ERROR_LOG"
            );

            return reply.code(500).send({
                ok: false,
                error: plain.message || "AUTH_COMPLETE_FAILED",
                detail: plain,
            });
        }
    });

    app.get("/v1/auth/session", async (req: any, reply) => {
        const member = req.session?.member;

        app.log.info(
            {
                cookieHeader: req.headers.cookie ?? "",
                sessionMember: member ?? null,
                host: req.headers.host ?? "",
            },
            "AUTH_SESSION_DEBUG"
        );

        return reply.send({
            ok: true,
            loggedIn: !!member?.uid,
            member: member ?? null,
        });
    });

    app.post("/v1/auth/logout", async (req: any, reply) => {
        await req.session.destroy();
        return reply.send({ ok: true });
    });
}