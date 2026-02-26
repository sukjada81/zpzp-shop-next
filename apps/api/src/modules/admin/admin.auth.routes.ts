// apps/api/src/modules/admin/admin.auth.routes.ts
import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";

type AdminSession = {
    admin?: {
        id: string;
        email?: string | null;
        name: string;
        isSuperAdmin: boolean;
    };
};

export async function adminAuthRoutes(app: FastifyInstance) {
    // 로그인
    app.post("/admin/auth/login", async (req: any, reply) => {
        const body = (req.body ?? {}) as { id?: string; password?: string };
        const id = String(body.id ?? "").trim();
        const password = String(body.password ?? "").trim();

        if (!id || !password) {
            return reply.code(400).send({ ok: false, message: "id/password required" });
        }

        // 세션 플러그인 누락 방지
        if (!req.session) {
            return reply.code(500).send({
                ok: false,
                message: "session is not initialized (check @fastify/cookie/@fastify/session registration)",
            });
        }

        // ✅ users.email 컬럼을 “아이디”로 쓰는 정책 (현재 admin = email 컬럼에 저장)
        const user = await app.prisma.user.findUnique({
            where: { email: id },
            select: {
                id: true,
                email: true,
                name: true,
                passwordHash: true,
                isSuperAdmin: true,
                status: true,
            },
        });

        if (!user || user.status !== "active" || !user.passwordHash) {
            return reply.code(401).send({ ok: false, message: "invalid credentials" });
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
            return reply.code(401).send({ ok: false, message: "invalid credentials" });
        }

        // ✅ 통합 관리자는 super_admin만 허용
        if (!user.isSuperAdmin) {
            return reply.code(403).send({ ok: false, message: "forbidden" });
        }

        // ✅ 세션 저장
        (req.session as AdminSession).admin = {
            id: String(user.id),
            email: user.email,
            name: user.name,
            isSuperAdmin: user.isSuperAdmin,
        };

        return reply.send({ ok: true });
    });

    // 세션 확인
    app.get("/admin/auth/session", async (req: any, reply) => {
        const admin = (req.session as AdminSession | undefined)?.admin;
        if (!admin) return reply.code(401).send({ ok: false });
        return reply.send({ ok: true, admin });
    });

    // 로그아웃
    app.post("/admin/auth/logout", async (req: any, reply) => {
        if (req.session) {
            await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
        }
        return reply.send({ ok: true });
    });
}