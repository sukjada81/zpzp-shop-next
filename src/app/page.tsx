// src/app/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function hasUserSession(cookieHeader: string) {
  const apiBase =
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://127.0.0.1:4000";

  try {
    const res = await fetch(`${apiBase.replace(/\/+$/, "")}/v1/auth/session`, {
      headers: {
        accept: "application/json",
        cookie: cookieHeader,
      },
      cache: "no-store",
    });

    if (!res.ok) return false;

    const data = await res.json().catch(() => null);
    return !!data?.loggedIn;
  } catch {
    return false;
  }
}

export default async function RootPage() {
  const ck = await cookies();

  const cookieHeader = ck
      .getAll()
      .map((item) => `${item.name}=${item.value}`)
      .join("; ");

  const AUTH_ORIGIN =
      process.env.AUTH_ORIGIN || process.env.MAIN_ORIGIN || "https://auth.zpzp.kr";
  const SELECT_TENANT_ORIGIN =
      process.env.SELECT_TENANT_ORIGIN || "https://select-tenant.zpzp.kr";

  const loggedIn = await hasUserSession(cookieHeader);

  if (!loggedIn) {
    const u = new URL("/login", AUTH_ORIGIN);
    u.searchParams.set("returnTo", new URL("/", SELECT_TENANT_ORIGIN).toString());
    return redirect(u.toString());
  }

  return redirect(new URL("/", SELECT_TENANT_ORIGIN).toString());
}