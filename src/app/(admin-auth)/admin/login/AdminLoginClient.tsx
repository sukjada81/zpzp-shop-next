"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { adminLogin } from "@/lib/admin/adminAuthClient";

export default function AdminLoginClient() {
    const router = useRouter();
    const sp = useSearchParams();
    const rawReturnTo = sp.get("returnTo") || "/dashboard";
    const returnTo =
        rawReturnTo === "/admin" || rawReturnTo === "/admin/dashboard"
            ? "/dashboard"
            : rawReturnTo;

    const [id, setId] = useState("admin"); // 기본값은 편의용(원하시면 빈값으로)
    const [password, setPassword] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isPending, startTransition] = useTransition();

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;

        setErr(null);
        setLoading(true);

        try {
            await adminLogin(id, password);

            // ✅ 세션 반영을 위해 "서버 트리 재렌더"까지 같이 해줘야 합니다.
            startTransition(() => {
                router.replace(returnTo);
                router.refresh();
            });
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

                    <form onSubmit={onSubmit} className="mt-6 space-y-3">
                        <label className="block">
                            <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">아이디</div>
                            <input
                                className="h-12 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                                value={id}
                                onChange={(e) => setId(e.target.value)}
                                placeholder="아이디 입력"
                                autoComplete="username"
                                name="username"
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
                                autoComplete="current-password"
                                name="password"
                            />
                        </label>

                        {err && (
                            <div className="rounded-2xl border border-[var(--dad-border)] bg-white/70 p-3 text-xs">
                                <div className="font-extrabold text-[var(--dad-ink)]">로그인 실패</div>
                                <div className="mt-1 text-[var(--dad-muted)]">{err}</div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || isPending}
                            className="dad-btn dad-btn-primary mt-2 h-12 w-full text-sm disabled:opacity-60"
                        >
                            {loading || isPending ? "로그인 중..." : "로그인"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}