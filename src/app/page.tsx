// src/app/page.tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  // ✅ 개발 중 기본 테넌트로 보내기 (원하면 여기만 바꾸면 됨)
  redirect("/test/login");
}