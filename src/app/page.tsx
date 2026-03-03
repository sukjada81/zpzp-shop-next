// src/app/page.tsx
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

function isAuthed(ck: Awaited<ReturnType<typeof cookies>>) {
  // 현재는 MOCK_AUTH 기준. (나중에 실제 세션 쿠키로 교체)
  return ck.get("mockLogin")?.value === "1";
}

function getHost(h: Headers) {
  return (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
}

export default async function RootPage() {
  const ck = await cookies();
  const h = await headers();
  const host = getHost(h);

  const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://discountallday.kr";
  const AUTH_ORIGIN = process.env.MAIN_ORIGIN || "https://auth.discountallday.kr";

  const loggedIn = isAuthed(ck);

  // ✅ main(auth 아님) 도메인 루트 접속 정책
  // - 로그인 전: auth로 보낸다 (returnTo는 main의 /select-tenant)
  // - 로그인 후: main의 /select-tenant 로 보낸다
  const onAuthHost = host.startsWith("auth.");
  if (!loggedIn) {
    const u = new URL("/login", AUTH_ORIGIN);
    u.searchParams.set("returnTo", new URL("/select-tenant", SITE_ORIGIN).toString());
    return redirect(u.toString());
  }

  // 로그인되어 있으면 무조건 main select-tenant부터
  // (선택했던 지점 기억 UX를 원하면, selectedTenant 쿠키를 다시 도입하면 됩니다)
  if (!onAuthHost) {
    return redirect("/select-tenant");
  }

  // auth 도메인에서 / 로 들어오는 케이스도 main으로 정리
  return redirect(new URL("/select-tenant", SITE_ORIGIN).toString());
}