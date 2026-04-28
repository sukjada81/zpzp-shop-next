import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
    interface FastifyInstance {
        prisma: PrismaClient;
    }
}

export async function prismaPlugin(app: FastifyInstance) {
    const prisma = new PrismaClient();

    app.decorate("prisma", prisma);

    // 서버 시작과 동시에 백그라운드로 DB 연결 웜업 (첫 요청 지연 방지)
    prisma.$connect()
        .then(() => app.log.info("Prisma DB connected"))
        .catch((err) => app.log.warn({ err }, "Prisma warm-up failed — will retry on first query"));

    app.addHook("onClose", async () => {
        await prisma.$disconnect();
    });
}