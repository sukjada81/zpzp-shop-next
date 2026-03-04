// src/app/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function isAuthed(ck: Awaited<ReturnType<typeof cookies>>) {
  // 현재는 MOCK_AUTH 기준. (나중에 실제 세션 쿠키로 교체)
  return ck.get("mockLogin")?.value === "1";
}

export default async function RootPage() {
  const ck = await cookies();
  const loggedIn = isAuthed(ck);

  const AUTH_ORIGIN = process.env.AUTH_ORIGIN || process.env.MAIN_ORIGIN || "https://auth.discountallday.kr";
  const SELECT_TENANT_ORIGIN = process.env.SELECT_TENANT_ORIGIN || "https://select-tenant.discountallday.kr";

  // 로그인 전: auth로 보내고 returnTo는 select-tenant 서브도메인 루트
  if (!loggedIn) {
    const u = new URL("/login", AUTH_ORIGIN);
    u.searchParams.set("returnTo", new URL("/", SELECT_TENANT_ORIGIN).toString());
    return redirect(u.toString());
  }

  // 로그인 후: select-tenant 서브도메인 루트로
  return redirect(new URL("/", SELECT_TENANT_ORIGIN).toString());
}