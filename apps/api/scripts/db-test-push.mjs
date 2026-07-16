// apps/api/scripts/db-test-push.mjs
//
// `npm run db:test:push`가 실제로 실행하는 스크립트.
// Prisma datasource는 항상 env("DATABASE_URL")을 읽는다 — `.env.test`가 DATABASE_URL_TEST만
// 정의하고 DATABASE_URL을 정의하지 않으면, dotenv -e .env.test 뒤에도 `.env`(apps/api/.env,
// 로컬 b2bdb)의 DATABASE_URL이 그대로 남아있어 --force-reset이 로컬 b2bdb를 지워버린다.
//
// test/global-setup.ts와 동일한 안전장치를 여기서도 적용한다:
//   1) DATABASE_URL_TEST가 없으면 즉시 중단(스킵이 아니라 실패 — 수동 실행이므로 실수 방지 우선)
//   2) 스키마명이 b2bdb_test가 아니면 즉시 중단
//   3) DATABASE_URL을 DATABASE_URL_TEST 값으로 덮어써서 prisma db push 실행
//
// cross-env 등 새 의존성 없이 Node 내장 모듈만 사용(child_process는 global-setup.ts에서도 사용 중).
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL_TEST;

if (!url) {
  console.error(
    "[db:test:push] DATABASE_URL_TEST not set in apps/api/.env.test — refusing to run " +
      "(would fall back to DATABASE_URL / local b2bdb and wipe it).",
  );
  process.exit(1);
}

if (!/b2bdb_test/.test(url)) {
  console.error("[db:test:push] Refusing: test DB must be b2bdb_test (got: " + url + ")");
  process.exit(1);
}

execSync("prisma db push --force-reset --skip-generate", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
  cwd: process.cwd(),
});
