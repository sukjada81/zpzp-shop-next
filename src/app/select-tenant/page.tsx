// src/app/select-tenant/page.tsx
import { cookies } from "next/headers";
import Link from "next/link";
import { getTenantList } from "@/lib/tenant/tenants";

const TENANT_IMAGES: Record<string, { label?: string }> = {
    // slug별로 실제 이미지가 생기면 여기만 바꾸면 됩니다.
    // 예: "a": { image: "/tenants/a.jpg" }
};

function normalizeTenant(raw: string) {
    const t = (raw || "").toLowerCase().trim();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

export default async function SelectTenantPage() {
    const ck = await cookies();

    // ✅ 전역 로그인 상태(임시: mockLogin)
    const isLoggedIn = ck.get("mockLogin")?.value === "1";

    // ✅ 현재 선택 지점(= active tenant)
    const active = normalizeTenant(ck.get("selectedTenant")?.value || "");

    const tenants = getTenantList();

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24">
            <div className="pt-7">
                {/* 타이틀: 최소 문구 */}
                <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[22px] font-extrabold tracking-tight text-[color:var(--fg)]">
                            지점 선택
                        </div>
                        <div className="mt-1 text-[12px] font-semibold text-[color:var(--muted)]">
                            원하시는 지점을 눌러 들어가세요.
                        </div>
                    </div>

                    {/* 상태 뱃지(최소) */}
                    <div className="shrink-0">
            {/*<span*/}
            {/*    className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold"*/}
            {/*    style={{*/}
            {/*        background: "var(--brand-soft)",*/}
            {/*        color: "var(--brand)",*/}
            {/*        border: "1px solid var(--border)",*/}
            {/*    }}*/}
            {/*    title={isLoggedIn ? "로그인됨" : "로그인 전"}*/}
            {/*>*/}
            {/*  {isLoggedIn ? "로그인" : "게스트"}*/}
            {/*</span>*/}
                    </div>
                </div>

                {/* 카드 그리드 */}
                <section className="mt-5 grid gap-3">
                    {tenants.map((t) => {
                        const slug = normalizeTenant(t.slug);
                        const isActive = !!active && slug === active;

                        // placeholder “빌딩 이미지” 영역에 들어갈 보조 라벨 (필요하면 사용)
                        const imgLabel = TENANT_IMAGES[slug]?.label;

                        return (
                            <Link
                                key={t.slug}
                                href={`/api/tenant/select?tenant=${encodeURIComponent(t.slug)}`}
                                className={[
                                    "group block overflow-hidden rounded-2xl border bg-white shadow-sm transition",
                                    "hover:-translate-y-[1px] hover:shadow-md active:scale-[0.995]",
                                    isActive ? "border-[color:var(--brand)]" : "border-[color:var(--border)]",
                                ].join(" ")}
                                aria-label={`${t.name} 선택`}
                            >
                                {/* 빌딩 이미지(placeholder) */}
                                <div
                                    className="relative h-[110px] w-full"
                                    style={{ background: "var(--brand-soft)" }}
                                >
                                    {/* 심플한 느낌의 패턴/실루엣 */}
                                    <div className="absolute inset-0 opacity-[0.9]">
                                        <svg
                                            viewBox="0 0 520 160"
                                            className="h-full w-full"
                                            preserveAspectRatio="none"
                                            aria-hidden="true"
                                        >
                                            <rect x="0" y="0" width="520" height="160" fill="white" opacity="0.55" />
                                            {/* 건물들 */}
                                            <rect x="28" y="58" width="78" height="86" rx="10" fill="rgba(0,0,0,0.05)" />
                                            <rect x="118" y="36" width="110" height="108" rx="12" fill="rgba(0,0,0,0.06)" />
                                            <rect x="244" y="62" width="86" height="82" rx="10" fill="rgba(0,0,0,0.05)" />
                                            <rect x="342" y="30" width="150" height="114" rx="14" fill="rgba(0,0,0,0.07)" />
                                            {/* 창문 라인 */}
                                            <g opacity="0.55">
                                                {Array.from({ length: 6 }).map((_, i) => (
                                                    <rect
                                                        key={`w1-${i}`}
                                                        x={134 + i * 14}
                                                        y="52"
                                                        width="8"
                                                        height="8"
                                                        rx="2"
                                                        fill="rgba(255,255,255,0.9)"
                                                    />
                                                ))}
                                            </g>
                                        </svg>
                                    </div>

                                    {/* 좌상단: 현재 뱃지 */}
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

                                    {/* 우하단: slug(작게) */}
                    {/*                <div className="absolute bottom-3 right-3">*/}
                    {/*<span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-extrabold text-[color:var(--muted)]">*/}
                    {/*  /{t.slug}*/}
                    {/*</span>*/}
                    {/*                </div>*/}

                                    {/* (선택) 이미지 라벨 */}
                                    {imgLabel ? (
                                        <div className="absolute bottom-3 left-3">
                      <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-extrabold text-[color:var(--muted)]">
                        {imgLabel}
                      </span>
                                        </div>
                                    ) : null}
                                </div>

                                {/* 하단 텍스트 */}
                                <div className="p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-[16px] font-extrabold text-[color:var(--fg)]">
                                                {t.name}
                                            </div>
                                            {/* desc는 “있으면만” 아주 작게 */}
                                            {t.desc ? (
                                                <div className="mt-1 line-clamp-1 text-[12px] font-semibold text-[color:var(--muted)]">
                                                    {t.desc}
                                                </div>
                                            ) : (
                                                <div className="mt-1 text-[12px] font-semibold text-[color:var(--muted)]">
                                                    {/* 문구 최소화: 빈 줄 대신 얇은 안내 */}
                                                    선택 후 바로 이동합니다.
                                                </div>
                                            )}
                                        </div>

                                        <div
                                            className="grid h-11 w-11 place-items-center rounded-2xl border bg-white"
                                            style={{ borderColor: "var(--border)" }}
                                            aria-hidden="true"
                                        >
                      <span className="text-[18px]">
                        {isActive ? "✅" : "🏢"}
                      </span>
                                        </div>
                                    </div>

                                    {/* CTA 바(심플) */}
                                    <div
                                        className={[
                                            "mt-3 rounded-xl py-2 text-center text-[12px] font-extrabold",
                                            isActive
                                                ? "bg-[color:var(--brand-soft)] text-[color:var(--brand)]"
                                                : "bg-[color:var(--accent-soft)] text-[color:var(--fg)] group-hover:opacity-90",
                                        ].join(" ")}
                                        style={{
                                            border: "1px solid var(--border)",
                                        }}
                                    >
                                        {isActive ? "선택됨" : "선택"}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </section>

                {/* 아래 설명 박스 제거(요청: 문구 최소화) */}
            </div>
        </main>
    );
}