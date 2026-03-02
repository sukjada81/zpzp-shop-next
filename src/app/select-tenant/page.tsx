// src/app/select-tenant/page.tsx
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { getTenantList } from "@/lib/tenant/tenants";

const TENANT_IMAGES: Record<string, { label?: string }> = {};

function normalizeTenant(raw: string) {
    const t = (raw || "").toLowerCase().trim();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

function isLocalHost(currentHost: string) {
    const hostOnly = currentHost.split(",")[0]?.trim().split(":")[0] ?? "";
    return hostOnly === "localhost" || hostOnly.endsWith(".localhost") || currentHost.includes(":3000");
}

function buildMainLoginUrl(currentHost: string, tenant: string) {
    const base = isLocalHost(currentHost) ? "http://discountallday.kr:3000" : "https://discountallday.kr";
    const u = new URL("/login", base);
    u.searchParams.set("tenant", tenant);
    u.searchParams.set("returnTo", "/home");
    return u.toString();
}

function buildTenantHomeUrl(currentHost: string, tenant: string) {
    const baseDomain = process.env.TENANT_BASE_DOMAIN || "discountallday.kr";
    if (isLocalHost(currentHost)) {
        return `http://${tenant}.${baseDomain}:3000/home`;
    }
    return `https://${tenant}.${baseDomain}/home`;
}

export default async function SelectTenantPage() {
    const ck = await cookies();
    const h = await headers();
    const currentHost = (h.get("x-forwarded-host") || h.get("host") || "").trim();

    // ✅ 로그인 여부 (현재는 MOCK_AUTH 기준)
    const isLoggedIn = ck.get("mockLogin")?.value === "1";

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

                        // ✅ 핵심:
                        // - 로그인 전: 메인 도메인에서 로그인으로 이동(tenant 포함)
                        // - 로그인 후: 바로 지점 홈으로 이동
                        const href = isLoggedIn
                            ? buildTenantHomeUrl(currentHost, slug)
                            : buildMainLoginUrl(currentHost, slug);

                        return (
                            <Link
                                key={t.slug}
                                href={href}
                                className={[
                                    "group w-full text-left block overflow-hidden rounded-2xl border bg-white shadow-sm transition",
                                    "hover:-translate-y-[1px] hover:shadow-md active:scale-[0.995]",
                                ].join(" ")}
                                aria-label={`${t.name} 선택`}
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
                                                {isLoggedIn ? "선택 시 해당 지점 홈으로 이동합니다." : "선택 후 로그인 화면으로 이동합니다."}
                                            </div>
                                        </div>

                                        <div
                                            className="grid h-11 w-11 place-items-center rounded-2xl border bg-white"
                                            style={{ borderColor: "var(--border)" }}
                                            aria-hidden="true"
                                        >
                                            <span className="text-[18px]">{isLoggedIn ? "✅" : "🏢"}</span>
                                        </div>
                                    </div>

                                    <div
                                        className={[
                                            "mt-3 rounded-xl py-2 text-center text-[12px] font-extrabold",
                                            isLoggedIn
                                                ? "bg-[color:var(--brand-soft)] text-[color:var(--brand)]"
                                                : "bg-[color:var(--accent-soft)] text-[color:var(--fg)] group-hover:opacity-90",
                                        ].join(" ")}
                                        style={{ border: "1px solid var(--border)" }}
                                    >
                                        {isLoggedIn ? "홈으로 이동" : "선택"}
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