// src/app/(site)/[tenant]/(app)/settings/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type AuthSession = {
    ok: boolean;
    loggedIn: boolean;
    tenant?: string;
    user?: { id: string; provider: string } | null;
};

function profileKey(tenant: string) {
    return `profile:${tenant || "default"}`;
}

export default function SettingsPage() {
    const { tenant } = useParams<{ tenant: string }>();
    const [checking, setChecking] = useState(true);

    const [nickname, setNickname] = useState("");
    const [phone, setPhone] = useState("");
    const [savedAt, setSavedAt] = useState<number | null>(null);

    const helper = useMemo(() => {
        return {
            nickname:
                "(또는 운영 채팅방)과 동일한 닉네임으로 입력해 주세요. 하단 버튼에서 확인할 수 있습니다.",
            phone: "픽업 알림톡 발송 시 필요합니다.",
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function runAuthCheck() {
            try {
                const res = await fetch("/auth/session", { cache: "no-store" });
                const data = (await res.json()) as AuthSession;

                if (cancelled) return;

                if (!data.loggedIn) {
                    const authOrigin =
                        process.env.NEXT_PUBLIC_AUTH_ORIGIN || "https://auth.discountallday.kr";
                    const returnTo = window.location.href;
                    const loginUrl = new URL("/login", authOrigin);
                    if (tenant) loginUrl.searchParams.set("tenant", tenant);
                    loginUrl.searchParams.set("returnTo", returnTo);
                    window.location.replace(loginUrl.toString());
                    return;
                }

                try {
                    const raw = localStorage.getItem(profileKey(tenant));
                    if (raw) {
                        const p = JSON.parse(raw) as { nickname?: string; phone?: string };
                        setNickname(p.nickname || "");
                        setPhone(p.phone || "");
                    }
                } catch { }

                setChecking(false);
            } catch {
                if (cancelled) return;
                const authOrigin =
                    process.env.NEXT_PUBLIC_AUTH_ORIGIN || "https://auth.discountallday.kr";
                const returnTo = window.location.href;
                const loginUrl = new URL("/login", authOrigin);
                if (tenant) loginUrl.searchParams.set("tenant", tenant);
                loginUrl.searchParams.set("returnTo", returnTo);
                window.location.replace(loginUrl.toString());
            }
        }

        if (tenant) runAuthCheck();

        return () => {
            cancelled = true;
        };
    }, [tenant]);

    function save() {
        try {
            localStorage.setItem(profileKey(tenant), JSON.stringify({ nickname, phone }));
            setSavedAt(Date.now());
            alert("저장되었습니다.");
        } catch {
            alert("저장에 실패했습니다. 브라우저 저장공간을 확인해주세요.");
        }
    }

    function logout() {
        window.location.href = `/auth/logout?tenant=${encodeURIComponent(tenant)}`;
    }

    if (!tenant || checking) {
        return (
            <main className="mx-auto w-full max-w-[520px] px-4 py-10 text-center text-slate-500">
                로그인 상태를 확인하는 중입니다.
            </main>
        );
    }

    return (
        <main className="mx-auto w-full max-w-[520px] px-4 py-5">
            <div className="text-center text-[16px] font-extrabold text-slate-900">설정</div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[13px] font-extrabold text-slate-900">닉네임</div>
                <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="닉네임"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[14px] outline-none focus:border-slate-300"
                />
                <div className="mt-2 text-[12px] text-slate-500 leading-5">
                    • {helper.nickname}
                </div>

                <button
                    type="button"
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-extrabold text-slate-800 hover:bg-slate-50"
                    onClick={() => alert("프론트-only 단계: 실제 오픈채팅 링크/확인 로직은 추후 연결")}
                >
                    오픈채팅방에서 닉네임 확인하기
                </button>

                <div className="mt-6 text-[13px] font-extrabold text-slate-900">전화번호</div>
                <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="연락처('-' 없이)"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[14px] outline-none focus:border-slate-300"
                />
                <div className="mt-2 text-[12px] text-slate-500 leading-5">• {helper.phone}</div>

                <button
                    type="button"
                    onClick={save}
                    className="mt-5 w-full rounded-xl py-3 text-[15px] font-extrabold text-white active:scale-[0.99]"
                    style={{ background: "var(--brand)" }}
                >
                    저장
                </button>

                {savedAt ? (
                    <div className="mt-2 text-center text-[11px] text-slate-400">
                        마지막 저장: {new Date(savedAt).toLocaleString()}
                    </div>
                ) : null}
            </div>

            <button
                type="button"
                onClick={logout}
                className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-extrabold text-slate-800 hover:bg-slate-50"
            >
                로그아웃
            </button>
        </main>
    );
}