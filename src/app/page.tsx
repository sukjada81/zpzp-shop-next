// src/app/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function normalizeTenant(raw: string) {
  const t = (raw || "").toLowerCase().trim();
  if (!t || t === "undefined" || t === "null") return "";
  return t;
}

export default async function RootPage() {
  const ck = await cookies();

  // ✅ 지금 프로젝트에서 로그인 판별(예: mockLogin=1) 방식에 맞춰 사용
  // 실제 카카오 세션 쿠키가 따로 있으면 여기 조건을 그걸로 바꾸면 됨
  const isLoggedIn = ck.get("mockLogin")?.value === "1";

  if (!isLoggedIn) {
    redirect("/login");
  }

  const selectedTenant = normalizeTenant(ck.get("selectedTenant")?.value || "");

  if (!selectedTenant) {
    redirect("/select-tenant");
  }

  redirect(`/${selectedTenant}/home`);
}