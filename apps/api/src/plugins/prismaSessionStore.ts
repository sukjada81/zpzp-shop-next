// apps/api/src/plugins/prismaSessionStore.ts
import type { PrismaClient } from "@prisma/client";

const TABLE = "dad_sessions";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

export class PrismaSessionStore {
    constructor(private prisma: PrismaClient) {}

    async init(): Promise<void> {
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS \`${TABLE}\` (
                session_id VARCHAR(255) NOT NULL,
                expires     BIGINT UNSIGNED NOT NULL,
                data        MEDIUMTEXT NOT NULL,
                PRIMARY KEY (session_id),
                KEY idx_expires (expires)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        this.startCleanup();
    }

    // 만료된 세션 주기 정리 (15분마다)
    private startCleanup(intervalMs = 15 * 60 * 1000) {
        const timer = setInterval(() => {
            this.prisma.$executeRawUnsafe(
                `DELETE FROM \`${TABLE}\` WHERE expires < ?`,
                Date.now()
            ).catch(() => {});
        }, intervalMs);
        // 프로세스 종료를 막지 않도록
        if ((timer as any).unref) (timer as any).unref();
    }

    get(sid: string, callback: (err: Error | null, session?: any) => void): void {
        this.prisma.$queryRawUnsafe<{ data: string }[]>(
            `SELECT data FROM \`${TABLE}\` WHERE session_id = ? AND expires > ?`,
            sid,
            Date.now()
        )
            .then((rows) => {
                if (!rows.length) return callback(null, null);
                try {
                    callback(null, JSON.parse(rows[0].data));
                } catch (e) {
                    callback(e as Error);
                }
            })
            .catch((e: Error) => callback(e));
    }

    set(sid: string, session: any, callback: (err?: Error) => void): void {
        const expires = session?.cookie?.expires
            ? new Date(session.cookie.expires).getTime()
            : Date.now() + DEFAULT_TTL_MS;

        this.prisma.$executeRawUnsafe(
            `INSERT INTO \`${TABLE}\` (session_id, expires, data)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE expires = VALUES(expires), data = VALUES(data)`,
            sid,
            expires,
            JSON.stringify(session)
        )
            .then(() => callback())
            .catch((e: Error) => callback(e));
    }

    destroy(sid: string, callback: (err?: Error) => void): void {
        this.prisma.$executeRawUnsafe(
            `DELETE FROM \`${TABLE}\` WHERE session_id = ?`,
            sid
        )
            .then(() => callback())
            .catch((e: Error) => callback(e));
    }
}
