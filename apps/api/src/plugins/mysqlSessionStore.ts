// apps/api/src/plugins/mysqlSessionStore.ts
import mysql from "mysql2/promise";

function parseDbUrl(url: string) {
    try {
        const u = new URL(url);
        return {
            host: u.hostname,
            port: u.port ? Number(u.port) : 3306,
            user: decodeURIComponent(u.username),
            password: decodeURIComponent(u.password),
            database: u.pathname.replace(/^\//, ""),
        };
    } catch {
        throw new Error(`Invalid DATABASE_URL: ${url}`);
    }
}

export function createSessionPool(dbUrl: string): mysql.Pool {
    return mysql.createPool({
        ...parseDbUrl(dbUrl),
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
    });
}

export class MySQLSessionStore {
    private pool: mysql.Pool;
    private table: string;

    constructor(pool: mysql.Pool, table = "dad_sessions") {
        this.pool = pool;
        this.table = table;
        this.initTable();
        this.startCleanup();
    }

    private async initTable() {
        await this.pool.execute(`
            CREATE TABLE IF NOT EXISTS \`${this.table}\` (
                session_id VARCHAR(255) NOT NULL,
                expires     BIGINT UNSIGNED NOT NULL,
                data        MEDIUMTEXT,
                PRIMARY KEY (session_id),
                KEY idx_expires (expires)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    }

    private startCleanup(intervalMs = 15 * 60 * 1000) {
        const timer = setInterval(() => {
            this.pool.execute(
                `DELETE FROM \`${this.table}\` WHERE expires < ?`,
                [Date.now()]
            ).catch(() => {});
        }, intervalMs);
        // Node 프로세스 종료를 막지 않도록
        if (timer.unref) timer.unref();
    }

    get(sid: string, callback: (err: Error | null, session?: any) => void): void {
        this.pool
            .execute<mysql.RowDataPacket[]>(
                `SELECT data FROM \`${this.table}\` WHERE session_id = ? AND expires > ?`,
                [sid, Date.now()]
            )
            .then(([rows]) => {
                if (!rows.length) return callback(null, null);
                try {
                    callback(null, JSON.parse(rows[0].data as string));
                } catch (e) {
                    callback(e as Error);
                }
            })
            .catch(callback);
    }

    set(sid: string, session: any, callback: (err?: Error) => void): void {
        const expires = session?.cookie?.expires
            ? new Date(session.cookie.expires).getTime()
            : Date.now() + 7 * 24 * 60 * 60 * 1000;

        this.pool
            .execute(
                `INSERT INTO \`${this.table}\` (session_id, expires, data)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE expires = VALUES(expires), data = VALUES(data)`,
                [sid, expires, JSON.stringify(session)]
            )
            .then(() => callback())
            .catch((e) => callback(e));
    }

    destroy(sid: string, callback: (err?: Error) => void): void {
        this.pool
            .execute(`DELETE FROM \`${this.table}\` WHERE session_id = ?`, [sid])
            .then(() => callback())
            .catch((e) => callback(e));
    }
}
