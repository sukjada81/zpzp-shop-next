// apps/api/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  // apps/api엔 CSS가 없지만, Vite가 monorepo 루트의 postcss.config.mjs(Next.js 앱용,
  // @tailwindcss/postcss 미설치)를 자동 탐색해 로드 실패하는 것을 막기 위해 명시적으로
  // 빈 postcss 설정을 지정한다(파일 탐색 우회).
  css: { postcss: {} },
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false, // 공유 테스트 DB — 파일 병렬 금지
    hookTimeout: 60000,
  },
});
