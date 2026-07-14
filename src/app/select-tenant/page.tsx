// src/app/select-tenant/page.tsx
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTenantList } from "@/lib/tenant/tenants";
import { normalizeTenant } from "@/lib/tenant/getTenant";

const TENANT_IMAGES: Record<string, { label?: string }> = {};

async function getSessionFromApi() {
    // ✅ SSR에서 현재 요청의 쿠키를 그대로 내부 API로 전달
    const h = await headers();
    const cookie = h.get("cookie") || "";

    const INTERNAL_ORIGIN = process.env.NEXT_INTERNAL_ORIGIN || "http://127.0.0.1:3000";
    const url = new URL("/api/auth/session", INTERNAL_ORIGIN);

    const res = await fetch(url.toString(), {
        headers: { cookie },
        cache: "no-store",
    });

    if (!res.ok) return { ok: false, loggedIn: false, tenant: "" };

    try {
        return (await res.json()) as { ok: boolean; loggedIn: boolean; tenant?: string };
    } catch {
        return { ok: false, loggedIn: false, tenant: "" };
    }
}

export default async function SelectTenantPage() {
    const AUTH_ORIGIN = process.env.AUTH_ORIGIN || process.env.MAIN_ORIGIN || "https://auth.zpzp.kr";
    const SELECT_TENANT_ORIGIN = process.env.SELECT_TENANT_ORIGIN || "https://select-tenant.zpzp.kr";

    // ✅ 로그인 여부는 API로 판별 (쿠키 domain/samesite 이슈로 루프 방지)
    const sess = await getSessionFromApi();
    const isLoggedIn = !!sess?.loggedIn;

    // ✅ 로그인 전이면 접근 금지 → auth로 보냄 (returnTo는 select-tenant 루트)
    if (!isLoggedIn) {
        const u = new URL("/login", AUTH_ORIGIN);
        u.searchParams.set("returnTo", new URL("/", SELECT_TENANT_ORIGIN).toString());
        return redirect(u.toString());
    }

    const tenants = getTenantList();

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24">
            <div className="pt-7">
                <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[22px] font-extrabold tracking-tight text-[color:var(--fg)]">지점 선택</div>
                        <div className="mt-1 text-[12px] font-semibold text-[color:var(--muted)]">
                            원하시는 지점을 눌러 들어가세요.
                        </div>
                    </div>
                </div>

                <section className="mt-5 grid gap-3">
                    {tenants.map((t) => {
                        const slug = normalizeTenant(t.slug);
                        const imgLabel = TENANT_IMAGES[slug]?.label;

                        // ✅ 핵심: 지점 선택은 항상 API 라우트로 (쿠키 세팅 + 올바른 redirect 보장)
                        const href = `/api/tenant/select?tenant=${encodeURIComponent(slug)}`;

                        return (
                            <Link
                                key={t.slug}
                                href={href}
                                className={[
                                    "group w-full text-left block overflow-hidden rounded-2xl border bg-white shadow-sm transition",
                                    "hover:-translate-y-[1px] hover:shadow-md active:scale-[0.995]",
                                ].join(" ")}
                                aria-label={`${t.name} 선택`}
                                prefetch={false}
                            >
                                <div className="relative h-[110px] w-full" style={{ background: "var(--brand-soft)" }}>
                                    {imgLabel ? (
                                        <div className="absolute bottom-3 left-3">
                      <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-extrabold text-[color:var(--muted)]">
                        {imgLabel}
                      </span>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-[16px] font-extrabold text-[color:var(--fg)]">{t.name}</div>
                                            <div className="mt-1 text-[12px] font-semibold text-[color:var(--muted)]">
                                                선택 시 해당 지점 홈으로 이동합니다.
                                            </div>
                                        </div>

                                        <div
                                            className="grid h-11 w-11 place-items-center rounded-2xl border bg-white"
                                            style={{ borderColor: "var(--border)" }}
                                            aria-hidden="true"
                                        >
                                            <span className="text-[18px]">✅</span>
                                        </div>
                                    </div>

                                    <div
                                        className="mt-3 rounded-xl py-2 text-center text-[12px] font-extrabold bg-[color:var(--brand-soft)] text-[color:var(--brand)]"
                                        style={{ border: "1px solid var(--border)" }}
                                    >
                                        홈으로 이동
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </section>
            </div>
        </main>
    );
}