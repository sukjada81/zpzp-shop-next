// src/app/(site)/[tenant]/(app)/settings/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BottomToast, { BottomToastTone } from "@/components/ui/BottomToast";
import {
    readQuickOrderProfile,
    saveQuickOrderProfile,
} from "@/lib/profile/quickOrderProfile";

type AuthSession = {
    ok?: boolean;
    loggedIn?: boolean;
    tenant?: string;
    member?: {
        uid?: string | number;
        id?: string;
        name?: string;
        email?: string;
        phone?: string;
    } | null;
};

type NicknameCheckState = "idle" | "checking" | "ok" | "notfound";

export default function SettingsPage() {
    const { tenant } = useParams<{ tenant: string }>();
    const router = useRouter();

    const [checking, setChecking] = useState(true);

    const [nickname, setNickname] = useState("");
    const [phone, setPhone] = useState("");
    const [recommenderNickname, setRecommenderNickname] = useState("");
    const [savedAt, setSavedAt] = useState<number | null>(null);

    const [openchatUrl, setOpenchatUrl] = useState<string | null>(null);

    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastTone, setToastTone] = useState<BottomToastTone>("success");

    const [nicknameCheckState, setNicknameCheckState] = useState<NicknameCheckState>("idle");
    const checkAbortRef = useRef<AbortController | null>(null);

    const helper = useMemo(() => {
        return {
            nickname:
                "디스카운트 올데이 오픈채팅방과 동일한 닉네임으로 입력해 주세요. 하단 버튼에서 확인할 수 있습니다.",
            phone: "픽업일 알림톡 발송 시 필요합니다.",
            recommender: "디스카운트 올데이를 추천해줬다면 추천인의 닉네임을 입력해주세요.",
        };
    }, []);

    function showToast(message: string, tone: BottomToastTone = "success") {
        setToastMessage(message);
        setToastTone(tone);
        setToastOpen(true);
    }

    function normalizePhone(v: string) {
        return String(v ?? "").replace(/[^\d]/g, "");
    }

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

                const profile = readQuickOrderProfile(tenant);
                if (profile) {
                    setNickname(String(profile.nickname ?? ""));
                    setPhone(String(profile.phone ?? ""));
                    setRecommenderNickname(String(profile.recommenderNickname ?? ""));
                    if (profile.recommenderNickname?.trim()) {
                        setNicknameCheckState("ok");
                    }
                }

                const tenantRes = await fetch(`/api/proxy/${tenant}/v1/public/tenant`, {
                    cache: "no-store",
                });
                if (tenantRes.ok) {
                    const tenantData = await tenantRes.json().catch(() => null);
                    setOpenchatUrl(tenantData?.item?.openchatUrl ?? null);
                }

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

    async function checkRecommenderNickname(value: string) {
        const trimmed = value.trim();
        if (!trimmed) {
            setNicknameCheckState("idle");
            return;
        }

        if (checkAbortRef.current) {
            checkAbortRef.current.abort();
        }
        const controller = new AbortController();
        checkAbortRef.current = controller;

        setNicknameCheckState("checking");
        try {
            const res = await fetch(
                `/api/proxy/v1/public/member/check-nickname?nickname=${encodeURIComponent(trimmed)}`,
                { cache: "no-store", signal: controller.signal }
            );
            const data = await res.json().catch(() => null);
            setNicknameCheckState(data?.exists ? "ok" : "notfound");
        } catch {
            if (!controller.signal.aborted) {
                setNicknameCheckState("idle");
            }
        }
    }

    async function save() {
        const normalizedNickname = nickname.trim();
        const normalizedPhone = normalizePhone(phone);

        if (!normalizedNickname) {
            showToast("닉네임을 입력해 주세요.", "error");
            return;
        }

        if (normalizedPhone.length < 10) {
            showToast("전화번호를 정확히 입력해 주세요.", "error");
            return;
        }

        if (recommenderNickname.trim() && nicknameCheckState === "notfound") {
            showToast("존재하지 않는 추천인 닉네임입니다. 비워두거나 올바른 닉네임을 입력해 주세요.", "error");
            return;
        }

        try {
            saveQuickOrderProfile(tenant, {
                nickname: normalizedNickname,
                phone: normalizedPhone,
                recommenderNickname: recommenderNickname.trim(),
            });

            await fetch("/api/proxy/v1/public/member/reference", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reference: recommenderNickname.trim() }),
            }).catch(() => null);

            setSavedAt(Date.now());
            showToast("저장 되었습니다.");
            window.setTimeout(() => {
                router.replace(`/${tenant}/home`);
            }, 900);
        } catch {
            showToast("저장에 실패했습니다. 브라우저 저장공간을 확인해주세요.", "error");
        }
    }

    function openChat() {
        if (openchatUrl) {
            window.open(openchatUrl, "_blank", "noopener,noreferrer");
            return;
        }
        showToast("오픈채팅 링크는 추후 연결 예정입니다.", "error");
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
        <>
            <main className="mx-auto w-full max-w-[520px] px-4 py-5">
                <div className="text-center text-[16px] font-extrabold text-slate-900">내 정보 설정</div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-[13px] font-extrabold text-slate-900">닉네임</div>
                    <input
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="닉네임"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[14px] outline-none focus:border-slate-300"
                    />
                    <div className="mt-2 text-[12px] leading-5 text-slate-500">
                        • {helper.nickname}
                    </div>

                    <button
                        type="button"
                        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-extrabold text-slate-800 hover:bg-slate-50"
                        onClick={openChat}
                    >
                        오픈채팅방에서 닉네임 확인하기
                    </button>

                    <div className="mt-6 text-[13px] font-extrabold text-slate-900">전화번호</div>
                    <input
                        value={phone}
                        onChange={(e) => setPhone(normalizePhone(e.target.value))}
                        inputMode="tel"
                        placeholder="연락처('-' 없이)"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[14px] outline-none focus:border-slate-300"
                    />
                    <div className="mt-2 text-[12px] leading-5 text-slate-500">• {helper.phone}</div>

                    <div className="mt-6 text-[13px] font-extrabold text-slate-900">
                        추천인 닉네임 <span className="font-medium text-slate-400">(선택)</span>
                    </div>
                    <input
                        value={recommenderNickname}
                        onChange={(e) => {
                            setRecommenderNickname(e.target.value);
                            setNicknameCheckState("idle");
                        }}
                        onBlur={(e) => checkRecommenderNickname(e.target.value)}
                        placeholder="추천해준 친구의 닉네임"
                        className={`mt-2 w-full rounded-xl border px-3 py-3 text-[14px] outline-none focus:border-slate-300 ${
                            nicknameCheckState === "notfound"
                                ? "border-rose-300 bg-rose-50"
                                : nicknameCheckState === "ok"
                                    ? "border-emerald-300 bg-emerald-50"
                                    : "border-slate-200 bg-white"
                        }`}
                    />
                    {nicknameCheckState === "checking" && (
                        <div className="mt-1.5 text-[12px] text-slate-400">확인 중...</div>
                    )}
                    {nicknameCheckState === "ok" && (
                        <div className="mt-1.5 text-[12px] font-medium text-emerald-600">✓ 확인된 회원입니다.</div>
                    )}
                    {nicknameCheckState === "notfound" && (
                        <div className="mt-1.5 text-[12px] font-medium text-rose-500">등록되지 않은 닉네임입니다.</div>
                    )}
                    {nicknameCheckState === "idle" && (
                        <div className="mt-2 text-[12px] leading-5 text-slate-500">• {helper.recommender}</div>
                    )}

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

            <BottomToast
                open={toastOpen}
                message={toastMessage}
                tone={toastTone}
                onClose={() => setToastOpen(false)}
            />
        </>
    );
}
