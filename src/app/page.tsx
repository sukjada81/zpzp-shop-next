// src/app/page.tsx
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

function isAuthed(ck: Awaited<ReturnType<typeof cookies>>) {
  // 현재는 MOCK_AUTH 기준. (나중에 실제 세션 쿠키로 교체)
  return ck.get("mockLogin")?.value === "1";
}

function getHost(h: Headers) {
  return (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim().toLowerCase();
}

export default async function RootPage() {
  const ck = await cookies();
  const h = await headers();
  const host = getHost(h);

  const AUTH_ORIGIN =
      process.env.AUTH_ORIGIN || process.env.MAIN_ORIGIN || "https://auth.discountallday.kr";
  const SELECT_TENANT_ORIGIN =
      process.env.SELECT_TENANT_ORIGIN || "https://select-tenant.discountallday.kr";
  const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://discountallday.kr";

  const loggedIn = isAuthed(ck);

  // ✅ 1) auth 서브도메인 루트(/)는 "항상 로그인 화면"으로 보낸다.
  // - 로그인 여부와 관계없이 /login 으로 정리(정책 고정)
  if (host.startsWith("auth.")) {
    const u = new URL("/login", AUTH_ORIGIN);

    // returnTo가 없으면 지점선택 서브도메인 루트가 기본
    u.searchParams.set("returnTo", new URL("/", SELECT_TENANT_ORIGIN).toString());

    return redirect(u.toString());
  }

  // ✅ 2) select-tenant 서브도메인 루트(/)는 middleware가 /select-tenant로 rewrite 해줌
  // 여기서 별도 처리 안 함(그대로 렌더 흐름 타게)
  if (host.startsWith("select-tenant.")) {
    // middleware가 "/" -> "/select-tenant" rewrite 하므로 여기까지 오는 경우는 거의 없음
    // 혹시 온다면 안전하게 select-tenant 페이지로 보냄
    return redirect("/select-tenant");
  }

  // ✅ 3) main 도메인(discountallday.kr) 루트 정책
  // - 로그인 전: auth/login 으로 보내기(returnTo=select-tenant 루트)
  // - 로그인 후: select-tenant 서브도메인 루트로 보내기
  if (!loggedIn) {
    const u = new URL("/login", AUTH_ORIGIN);
    u.searchParams.set("returnTo", new URL("/", SELECT_TENANT_ORIGIN).toString());
    return redirect(u.toString());
  }

  // 로그인되어 있으면 지점 선택으로
  return redirect(new URL("/", SELECT_TENANT_ORIGIN).toString());
}