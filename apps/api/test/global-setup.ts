// apps/api/test/global-setup.ts
//
// 테스트 DB에 Prisma 스키마를 push한다. 운영 DB(b2bdb, DAD 서버)를 절대 건드리지 않도록
// DATABASE_URL_TEST를 강제하고, 스키마명이 b2bdb_test가 아니면 즉시 중단한다.
//
// DB 배포 이전(현재) 단계: DATABASE_URL_TEST가 아직 설정되지 않았으므로 push를 건너뛰고
// 경고만 남긴다. 이렇게 해야 DB 없이도 스모크 테스트가 통과하고, 이후 태스크에서
// DATABASE_URL_TEST가 설정되면 안전장치가 그대로 살아난다.
import { execSync } from "node:child_process";

export default function setup() {
  const url = process.env.DATABASE_URL_TEST;

  if (!url) {
    console.warn(
      "[global-setup] DATABASE_URL_TEST not set — skipping prisma db push (DB-deferred mode).",
    );
    return;
  }

  if (!/b2bdb_test/.test(url)) {
    throw new Error("Refusing: test DB must be b2bdb_test");
  }

  execSync("prisma db push --force-reset --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
    cwd: process.cwd(),
  });
}
