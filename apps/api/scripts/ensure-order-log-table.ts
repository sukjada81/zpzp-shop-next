/**
 * 로컬/신규 DB 최초 1회 실행용 — dad_order_action_log (주문 취소 로그)
 * CREATE TABLE IF NOT EXISTS 이라 이미 있으면 아무 일도 안 함.
 *
 *   cd apps/api && npm run db:init:order-log
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_PATH = path.resolve(__dirname, "../../../infra/db/init/003_order_log.sql");

async function main() {
    const prisma = new PrismaClient();
    try {
        const before = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
            "SHOW TABLES LIKE 'dad_order_action_log'"
        );

        if (before.length > 0) {
            console.log("OK: dad_order_action_log already exists (skipped)");
            return;
        }

        const sql = fs
            .readFileSync(SQL_PATH, "utf8")
            .replace(/^--.*$/gm, "")
            .trim();

        await prisma.$executeRawUnsafe(sql);
        console.log("OK: dad_order_action_log created");
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
