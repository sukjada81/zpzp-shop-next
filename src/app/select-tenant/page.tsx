// src/app/select-tenant/page.tsx
import { cookies } from "next/headers";
import Link from "next/link";
import { getTenantList } from "@/lib/tenant/tenants";

export default async function SelectTenantPage() {
    const ck = await cookies();

    // ✅ 전역 로그인 상태(임시: mockLogin)
    const isLoggedIn = ck.get("mockLogin")?.value === "1";

    // ✅ 현재 선택 지점(= active tenant)
    // 기존 쿠키명이 selectedTenant이므로 우선 유지
    const active = (ck.get("selectedTenant")?.value || "").toLowerCase();

    const tenants = getTenantList();

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24">
            <div className="pt-8">
                <div className="text-[22px] font-extrabold text-slate-900 leading-tight">
                    가맹점(지점)을 선택해 주세요
                </div>

                <div className="mt-2 text-sm font-semibold text-slate-600">
                    지점마다 상품/주문/포인트 데이터가 분리됩니다.
                </div>

                {/* ✅ 로그인 상태 + active tenant가 있으면 안내만 보여주고, 리다이렉트는 하지 않음 */}
                {isLoggedIn ? (
                    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="text-[13px] font-extrabold text-slate-900">현재 상태</div>
                        <div className="mt-2 text-[12px] font-semibold text-slate-700">
                            로그인: <span className="font-extrabold">완료</span>
                        </div>
                        <div className="mt-1 text-[12px] font-semibold text-slate-700">
                            현재 지점:{" "}
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-extrabold text-slate-700">
                {active ? `/${active}` : "/-"}
              </span>
                        </div>
                        <div className="mt-2 text-[12px] font-semibold text-slate-600">
                            다른 지점으로 바꾸려면 아래 목록에서 선택하세요.
                        </div>
                    </div>
                ) : (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="text-[13px] font-extrabold text-amber-900">안내</div>
                        <div className="mt-2 text-[12px] font-semibold text-amber-800">
                            로그인하지 않아도 지점은 먼저 선택할 수 있어요.
                        </div>
                    </div>
                )}

                <div className="mt-6 grid gap-3">
                    {tenants.map((t) => {
                        const isActive = active && t.slug.toLowerCase() === active;
                        return (
                            <Link
                                key={t.slug}
                                href={`/api/tenant/select?tenant=${encodeURIComponent(t.slug)}`}
                                className={[
                                    "rounded-2xl border bg-white p-4 shadow-sm active:scale-[0.995]",
                                    isActive ? "border-[color:var(--brand)]" : "border-slate-200",
                                ].join(" ")}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[16px] font-extrabold text-slate-900">
                                            {t.name}
                                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-extrabold text-slate-700">
                        /{t.slug}
                      </span>
                                            {isActive ? (
                                                <span className="ml-2 rounded-full bg-[color:var(--brand-weak)] px-2 py-1 text-[11px] font-extrabold text-[color:var(--brand)]">
                          현재
                        </span>
                                            ) : null}
                                        </div>
                                        {t.desc ? (
                                            <div className="mt-1 text-[12px] font-semibold text-slate-600">
                                                {t.desc}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-50 border border-slate-200 text-lg">
                                        🏬
                                    </div>
                                </div>

                                <div className="mt-3 rounded-xl border border-slate-200 bg-white py-2 text-center text-[12px] font-extrabold text-slate-700">
                                    {isActive ? "현재 지점입니다" : "이 지점으로 변경 →"}
                                </div>
                            </Link>
                        );
                    })}
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[13px] font-extrabold text-slate-900">DB 분기 방식</div>
                    <ul className="mt-2 list-disc pl-5 text-[12px] font-semibold text-slate-700 space-y-1">
                        <li>계정은 전역 1개(users)로 유지합니다.</li>
                        <li>주문/포인트/장바구니는 tenant_id 기준으로 분기합니다.</li>
                        <li>지점 권한은 memberships(tenant_id,user_id)로 관리합니다.</li>
                    </ul>
                </div>
            </div>
        </main>
    );
}