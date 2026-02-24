// src/app/(admin)/admin/login/page.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function AdminLoginPage() {
    const router = useRouter();
    const sp = useSearchParams();
    const returnTo = sp.get("returnTo") || "/admin/dashboard";

    const onDevLogin = () => {
        document.cookie = "mockLogin=1; path=/;";
        router.replace(returnTo);
    };

    return (
        <div className="dad-admin min-h-dvh">
            <div className="mx-auto flex min-h-dvh w-full max-w-[1100px] items-center justify-center px-4 py-10">
                <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* left brand */}
                    <div className="dad-card p-8">
                        <div className="flex items-center gap-3">
                            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--dad-orange)] text-white text-2xl shadow">
                                😊
                            </div>
                            <div>
                                <div className="text-xl font-extrabold text-[var(--dad-ink)]">
                                    디스카운트 올데이
                                </div>
                                <div className="text-sm font-bold text-[var(--dad-muted)]">
                                    통합 관리자(Admin)
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 rounded-2xl border border-[var(--dad-border)] bg-white/70 p-4">
                            <div className="text-sm font-extrabold text-[var(--dad-ink)]">톤앤매너</div>
                            <div className="mt-2 flex items-center gap-2">
                                <div className="h-8 w-8 rounded-xl border border-[var(--dad-border)] bg-[var(--dad-cream)]" />
                                <div className="h-8 w-8 rounded-xl border border-[var(--dad-border)] bg-[var(--dad-orange)]" />
                                <div className="h-8 w-8 rounded-xl border border-[var(--dad-border)] bg-[var(--dad-ink)]" />
                                <span className="ml-2 text-xs font-bold text-[var(--dad-muted)]">
                  Cream / Orange / Ink
                </span>
                            </div>
                        </div>

                        <p className="mt-6 text-sm text-[var(--dad-muted)]">
                            전체 지점의 상품/주문/포인트를 한 곳에서 관리합니다.
                            <br />
                            실제 인증 연결 전 단계에서는 개발 로그인(mockLogin)로만 진입합니다.
                        </p>
                    </div>

                    {/* right form */}
                    <div className="dad-card p-8">
                        <div className="text-lg font-extrabold text-[var(--dad-ink)]">관리자 로그인</div>
                        <div className="mt-1 text-sm text-[var(--dad-muted)]">
                            (현재는 디자인/동선 확인용)
                        </div>

                        <div className="mt-6 space-y-3">
                            <label className="block">
                                <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">아이디</div>
                                <input
                                    className="h-12 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                                    placeholder="admin@example.com"
                                    disabled
                                />
                            </label>

                            <label className="block">
                                <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">비밀번호</div>
                                <input
                                    className="h-12 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                                    placeholder="••••••••"
                                    disabled
                                    type="password"
                                />
                            </label>

                            <button
                                onClick={onDevLogin}
                                className="dad-btn dad-btn-primary mt-2 h-12 w-full text-sm"
                            >
                                개발 로그인 (mockLogin)
                            </button>

                            <a
                                href="/select-tenant?change=1"
                                className="dad-btn dad-btn-ghost inline-flex h-12 w-full items-center justify-center text-sm"
                            >
                                고객 화면 지점 선택 →
                            </a>
                        </div>

                        <div className="mt-6 rounded-2xl border border-[var(--dad-border)] bg-white/70 p-4 text-xs text-[var(--dad-muted)]">
                            <div className="font-extrabold text-[var(--dad-ink)]">다음 단계</div>
                            <ul className="mt-2 list-disc pl-5 space-y-1">
                                <li>실제 관리자 인증(세션) 연동</li>
                                <li>super_admin만 “전체(all)” 조회 허용</li>
                                <li>로그아웃/세션 만료 처리</li>
                            </ul>
                        </div>

                        <div className="mt-4 text-xs text-[var(--dad-muted)]">
                            returnTo: <span className="font-mono text-[var(--dad-ink)]">{returnTo}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}