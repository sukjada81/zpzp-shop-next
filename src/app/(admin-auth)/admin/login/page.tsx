"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { adminLogin } from "@/lib/admin/adminAuthClient";

export default function AdminLoginPage() {
    const router = useRouter();
    const sp = useSearchParams();
    const returnTo = sp.get("returnTo") || "/admin/dashboard";

    const [id, setId] = useState("admin@example.com"); // 예시: email/phone/kakaoProviderId 모두 가능
    const [password, setPassword] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const onSubmit = async () => {
        setErr(null);
        setLoading(true);
        try {
            await adminLogin(id, password);
            router.replace(returnTo);
        } catch (e: any) {
            setErr(String(e?.message ?? e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dad-admin min-h-dvh">
            <div className="mx-auto flex min-h-dvh w-full max-w-[560px] items-center justify-center px-4 py-10">
                <div className="dad-card w-full p-8">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-[var(--dad-orange)] text-white text-xl shadow">
                            😊
                        </div>
                        <div>
                            <div className="text-lg font-extrabold text-[var(--dad-ink)]">디스카운트 올데이</div>
                            <div className="text-sm font-bold text-[var(--dad-muted)]">통합 관리자(Admin) 로그인</div>
                        </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-[var(--dad-border)] bg-white/70 p-4">
                        <div className="text-sm font-extrabold text-[var(--dad-ink)]">안내</div>
                        <div className="mt-1 text-xs text-[var(--dad-muted)]">
                            Super Admin만 접근 가능합니다. (아이디: email/phone/kakaoProviderId 중 하나)
                        </div>
                    </div>

                    <div className="mt-6 space-y-3">
                        <label className="block">
                            <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">아이디</div>
                            <input
                                className="h-12 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                                value={id}
                                onChange={(e) => setId(e.target.value)}
                                placeholder="아이디 입력"
                            />
                        </label>

                        <label className="block">
                            <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">비밀번호</div>
                            <input
                                className="h-12 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                type="password"
                            />
                        </label>

                        {err && (
                            <div className="rounded-2xl border border-[var(--dad-border)] bg-white/70 p-3 text-xs">
                                <div className="font-extrabold text-[var(--dad-ink)]">로그인 실패</div>
                                <div className="mt-1 text-[var(--dad-muted)]">{err}</div>
                            </div>
                        )}

                        <button
                            onClick={onSubmit}
                            disabled={loading}
                            className="dad-btn dad-btn-primary mt-2 h-12 w-full text-sm disabled:opacity-60"
                        >
                            {loading ? "로그인 중..." : "로그인"}
                        </button>

                        <div className="mt-2 text-xs text-[var(--dad-muted)]">
                            returnTo: <span className="font-mono text-[var(--dad-ink)]">{returnTo}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}