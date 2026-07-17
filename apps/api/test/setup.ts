// apps/api/test/setup.ts
//
// 테스트 전용 PrismaClient 싱글턴 + zpzp_* 테이블 리셋 헬퍼.
// 운영 DB(b2bdb)를 절대 가리키지 않도록 URL에 b2bdb_test가 포함되어 있는지 검사한다.
import { PrismaClient } from "@prisma/client";

let client: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!client) {
    const url = process.env.DATABASE_URL_TEST;
    if (!url || !/b2bdb_test/.test(url)) throw new Error("bad test DB url");
    client = new PrismaClient({ datasources: { db: { url } } });
  }
  return client;
}

export async function resetZpzpTables(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=0");
  await prisma.$executeRawUnsafe("TRUNCATE TABLE zpzp_referral_attribution");
  await prisma.$executeRawUnsafe("TRUNCATE TABLE zpzp_linker");
  await prisma.$executeRawUnsafe("TRUNCATE TABLE zpzp_confirmation_timer_event");
  await prisma.$executeRawUnsafe("TRUNCATE TABLE zpzp_order_confirmation");
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=1");
}
