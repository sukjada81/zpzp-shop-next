// apps/api/src/modules/public/auth.routes.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";

console.log("AUTH_ROUTES_LOADED_20260315");

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
    const slug = String(tenantSlug || "").trim().toLowerCase();

    console.log("RESOLVE_TENANT_SLUG", slug);

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

    console.log("DEBUG_TENANTS", allTenants);

    const tenant = await app.prisma.tenant.findFirst({
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

    console.log("RESOLVE_TENANT_RESULT", tenant);

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

export async function publicAuthRoutes(app: FastifyInstance) {
    console.log("PUBLIC_AUTH_ROUTES_REGISTERED");

    app.post("/v1/auth/kakao/complete", async (req: any, reply) => {
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
            return reply.code(400).send({
                ok: false,
                message: "TENANT_NOT_RESOLVED",
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
            const preferredLoginId = await generateUniqueMemberId(
                app,
                email ? email.split("@")[0] : "kakao"
            );

            console.log("KAKAO_CREATE_MEMBER_LOGIN_ID", preferredLoginId);

            const created = await app.prisma.mallRN_member.create({
                data: {
                    id: preferredLoginId,
                    name: displayName,
                    passwd: "",
                    tel: "",
                    cell: phone,
                    postcode: "",
                    address1: "",
                    address2: "",
                    email,
                    birth: "",
                    hobby: "",
                    job: "",
                    comp: "",
                    comp_owner: "",
                    comp_num: "",
                    comp_postcode: "",
                    comp_address1: "",
                    comp_address2: "",
                    comp_type: "",
                    comp_item: "",
                    comp_name: "",
                    comp_email: "",
                    comp_tel: "",
                    comp_fax: "",
                    cont_name: "",
                    cont_cell: "",
                    cont_email: "",
                    cont_part: "",
                    cont_position: "",
                    add1: "",
                    add2: "",
                    add3: "",
                    add4: "",
                    add5: "",
                    memo: "",
                    image1: "",
                    sns_type: "kakao",
                    sns_id: providerUserId,
                    sns_name: displayName,
                    dup_info: "",
                    mobile: "Y",
                    auth: "Y",
                    status: "active",
                    primary_role: "consumer",
                    default_tenant_id: tenant.id,
                    last_selected_tenant_id: tenant.id,
                    created_at_dt: now,
                    updated_at_dt: now,
                    last_login_at_dt: now,
                    login_time: nowTs,
                    signdate: nowTs,
                    reference: "",
                    auth_code: "",
                },
                select: {
                    uid: true,
                },
            });

            memberUid = Number(created.uid);
            console.log("KAKAO_CREATED_MEMBER_UID", memberUid);
        } else {
            await app.prisma.mallRN_member.update({
                where: { uid: memberUid },
                data: {
                    name: displayName || undefined,
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
    });

    app.get("/v1/auth/session", async (req: any, reply) => {
        const member = req.session?.member;

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