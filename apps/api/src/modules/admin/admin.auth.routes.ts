// apps/api/src/modules/admin/admin.auth.routes.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

type LoginBody = { id: string; password: string };

type AdminSession = {
    userId: string;
    loginId: string; // 입력한 id(표시용)
    name: string;
    isSuperAdmin: boolean;
};

declare module "fastify" {
    interface Session {
        admin?: AdminSession;
    }
}

export async function adminAuthRoutes(app: FastifyInstance) {
    const prisma = (app as unknown as { prisma: PrismaClient }).prisma;
    if (!prisma) throw new Error("prisma is not available on app");

    // POST /admin/auth/login
    app.post(
        "/admin/auth/login",
        async (req: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
            const loginId = (req.body?.id ?? "").trim();
            const password = String(req.body?.password ?? "");

            if (!loginId || !password) {
                reply.code(400);
                return reply.send({ ok: false, message: "id/password required" });
            }

            // ✅ DB 변경 없이: email OR phone OR kakaoProviderId 로 로그인 허용
            const user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: loginId.toLowerCase() },
                        { phone: loginId },
                        { kakaoProviderId: loginId },
                    ],
                },
                select: {
                    id: true,
                    email: true,
                    phone: true,
                    kakaoProviderId: true,
                    name: true,
                    passwordHash: true,
                    isSuperAdmin: true,
                    status: true,
                },
            });

            if (!user || user.status !== "active") {
                reply.code(401);
                return reply.send({ ok: false, message: "invalid credentials" });
            }

            // ✅ 통합 관리자: super admin만 접근
            if (!user.isSuperAdmin) {
                reply.code(403);
                return reply.send({ ok: false, message: "forbidden" });
            }

            if (!user.passwordHash) {
                reply.code(401);
                return reply.send({ ok: false, message: "invalid credentials" });
            }

            const ok = await bcrypt.compare(password, user.passwordHash);
            if (!ok) {
                reply.code(401);
                return reply.send({ ok: false, message: "invalid credentials" });
            }

            req.session.admin = {
                userId: String(user.id),
                loginId,
                name: user.name,
                isSuperAdmin: !!user.isSuperAdmin,
            };

            return reply.send({ ok: true, admin: req.session.admin });
        }
    );

    // GET /admin/auth/session
    app.get("/admin/auth/session", async (req: FastifyRequest, reply: FastifyReply) => {
        const s = req.session.admin;
        if (!s) {
            reply.code(401);
            return reply.send({ ok: false });
        }
        return reply.send({ ok: true, admin: s });
    });

    // POST /admin/auth/logout
    app.post("/admin/auth/logout", async (req: FastifyRequest, reply: FastifyReply) => {
        await new Promise<void>((resolve) => {
            const s: unknown = req.session as unknown;
            const destroy = (s as { destroy?: (cb?: (err?: Error) => void) => void }).destroy;

            if (typeof destroy === "function") destroy(() => resolve());
            else {
                req.session.admin = undefined;
                resolve();
            }
        });

        return reply.send({ ok: true });
    });
}