// src/app/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const ck = await cookies();

  const isLoggedIn = ck.get("mockLogin")?.value === "1";

  // ✅ active tenant (기존 쿠키명 유지)
  const tenant = (ck.get("selectedTenant")?.value || "").toLowerCase();

  // 로그인 안 했으면 지점 선택
  if (!isLoggedIn) {
    redirect("/select-tenant");
  }

  // 로그인 했는데 active tenant 없으면 지점 선택
  if (!tenant) {
    redirect("/select-tenant");
  }

  // 로그인 + tenant 있음
  redirect(`/${tenant}/home`);
}