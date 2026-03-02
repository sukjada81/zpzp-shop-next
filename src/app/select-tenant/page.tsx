// src/app/select-tenant/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTenantList } from "@/lib/tenant/tenants";

const TENANT_IMAGES: Record<string, { label?: string }> = {};

function normalizeTenant(raw: string) {
    const t = (raw || "").toLowerCase().trim();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

async function selectTenantAction(formData: FormData) {
    "use server";

    const raw = String(formData.get("tenant") ?? "");
    const tenant = normalizeTenant(raw);
    if (!tenant) redirect("/select-tenant");

    const ck = await cookies();

    ck.set("selectedTenant", tenant, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
    });

    // ✅ 로그인 전이면: 바로 /login으로 (tenant/returnTo 전달)
    const isLoggedIn = ck.get("mockLogin")?.value === "1";

    if (!isLoggedIn) {
         redirect(`/login?tenant=${encodeURIComponent(tenant)}&returnTo=${encodeURIComponent("/home")}`);
        // redirect(`/${tenant}/login?returnTo=${encodeURIComponent("/home")}`);
    }

    // ✅ 로그인 상태면 홈으로
    redirect(`/${tenant}/home`);
}

export default async function SelectTenantPage() {
    const ck = await cookies();
    const active = normalizeTenant(ck.get("selectedTenant")?.value || "");
    const tenants = getTenantList();

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24">
            <div className="pt-7">
                <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[22px] font-extrabold tracking-tight text-[color:var(--fg)]">
                            지점 선택
                        </div>
                        <div className="mt-1 text-[12px] font-semibold text-[color:var(--muted)]">
                            원하시는 지점을 눌러 들어가세요.
                        </div>
                    </div>
                </div>

                <section className="mt-5 grid gap-3">
                    {tenants.map((t) => {
                        const slug = normalizeTenant(t.slug);
                        const isActive = !!active && slug === active;
                        const imgLabel = TENANT_IMAGES[slug]?.label;

                        return (
                            <form key={t.slug} action={selectTenantAction}>
                                <input type="hidden" name="tenant" value={t.slug} />

                                <button
                                    type="submit"
                                    className={[
                                        "group w-full text-left block overflow-hidden rounded-2xl border bg-white shadow-sm transition",
                                        "hover:-translate-y-[1px] hover:shadow-md active:scale-[0.995]",
                                        isActive ? "border-[color:var(--brand)]" : "border-[color:var(--border)]",
                                    ].join(" ")}
                                    aria-label={`${t.name} 선택`}
                                >
                                    <div className="relative h-[110px] w-full" style={{ background: "var(--brand-soft)" }}>
                                        {isActive ? (
                                            <div className="absolute left-3 top-3">
                        <span
                            className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold"
                            style={{ background: "var(--brand)", color: "white" }}
                        >
                          현재 지점
                        </span>
                                            </div>
                                        ) : null}

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
                                                <div className="truncate text-[16px] font-extrabold text-[color:var(--fg)]">
                                                    {t.name}
                                                </div>
                                                <div className="mt-1 text-[12px] font-semibold text-[color:var(--muted)]">
                                                    선택 후 로그인 화면으로 이동합니다.
                                                </div>
                                            </div>

                                            <div
                                                className="grid h-11 w-11 place-items-center rounded-2xl border bg-white"
                                                style={{ borderColor: "var(--border)" }}
                                                aria-hidden="true"
                                            >
                                                <span className="text-[18px]">{isActive ? "✅" : "🏢"}</span>
                                            </div>
                                        </div>

                                        <div
                                            className={[
                                                "mt-3 rounded-xl py-2 text-center text-[12px] font-extrabold",
                                                isActive
                                                    ? "bg-[color:var(--brand-soft)] text-[color:var(--brand)]"
                                                    : "bg-[color:var(--accent-soft)] text-[color:var(--fg)] group-hover:opacity-90",
                                            ].join(" ")}
                                            style={{ border: "1px solid var(--border)" }}
                                        >
                                            {isActive ? "선택됨" : "선택"}
                                        </div>
                                    </div>
                                </button>
                            </form>
                        );
                    })}
                </section>
            </div>
        </main>
    );
}