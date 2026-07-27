// src/components/profile/ProfileSetupModal.tsx
"use client";

import { useEffect, useState } from "react";
import BottomToast, { BottomToastTone } from "@/components/ui/BottomToast";
import {
    dismissProfilePrompt,
    readQuickOrderProfile,
    saveQuickOrderProfile,
} from "@/lib/profile/quickOrderProfile";

export default function ProfileSetupModal({
                                              open,
                                              tenant,
                                              onClose,
                                              onSaved,
                                          }: {
    open: boolean;
    tenant: string;
    onClose: () => void;
    onSaved?: () => void;
    // (줍줍) DAD 오픈채팅 안내/버튼 제거로 openchatUrl 프롭도 폐지.
}) {
    const [nickname, setNickname] = useState("");
    const [phone, setPhone] = useState("");
    // (줍줍) 추천인 닉네임은 링크 귀속(zpzp_referral_attribution)과 이중 소스가 되어 비활성화. 상태만 남겨 저장부 호환 유지.
    const [recommenderNickname] = useState("");
    const [nicknameError, setNicknameError] = useState("");
    const [phoneError, setPhoneError] = useState("");
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastTone, setToastTone] = useState<BottomToastTone>("success");

    useEffect(() => {
        if (!open) return;

        const profile = readQuickOrderProfile(tenant);
        setNickname(String(profile?.nickname ?? ""));
        setPhone(String(profile?.phone ?? ""));
        setNicknameError("");
        setPhoneError("");
    }, [open, tenant]);

    function showToast(message: string, tone: BottomToastTone = "success") {
        setToastMessage(message);
        setToastTone(tone);
        setToastOpen(true);
    }

    function normalizePhone(v: string) {
        return String(v ?? "").replace(/[^\d]/g, "");
    }

    function handleLater() {
        dismissProfilePrompt(tenant);
        onClose();
    }

    // (줍줍) DAD 오픈채팅 안내 제거로 미사용 — 주석 보존.
    // function handleOpenChat() {
    //     if (openchatUrl) {
    //         window.open(openchatUrl, "_blank", "noopener,noreferrer");
    //         return;
    //     }
    //     showToast("오픈채팅 링크는 추후 연결 예정입니다.", "error");
    // }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        const normalizedNickname = nickname.trim();
        const normalizedPhone = normalizePhone(phone);

        // 검증 실패는 반드시 화면에 표시(무반응 금지): 필드 하단 인라인 에러 + 하단 토스트 병행.
        let nickMsg = "";
        let phoneMsg = "";

        if (!normalizedNickname) {
            nickMsg = "닉네임을 입력해 주세요.";
        }
        // 전화번호는 필수 유지(확정 정책 "닉네임·휴대폰 필수 수집" — 카카오 phone 미제공이라 이 폼이 유일 수집 경로).
        if (normalizedPhone.length < 10) {
            phoneMsg = "전화번호를 정확히 입력해 주세요.";
        }

        setNicknameError(nickMsg);
        setPhoneError(phoneMsg);

        if (nickMsg || phoneMsg) {
            showToast(nickMsg || phoneMsg, "error");
            return;
        }

        saveQuickOrderProfile(tenant, {
            nickname: normalizedNickname,
            phone: normalizedPhone,
            recommenderNickname: recommenderNickname.trim(),
        });

        // 닉네임/전화번호를 DB(member)에도 저장 (다른 기기/브라우저에서도 유지).
        // 실패해도 모달 통과에는 영향 없음(로컬 저장이 통과 기준). tenant는 서브도메인 host로 프록시가 주입.
        // (줍줍) reference(추천인)는 링크 귀속과 이중 소스가 되므로 전송하지 않음 — 기존 member.reference 덮어쓰기 방지.
        fetch("/api/proxy/v1/public/member/reference", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nickname: normalizedNickname,
                phone: normalizedPhone,
            }),
        }).catch(() => null);

        showToast("저장 되었습니다.");
        window.setTimeout(() => {
            setToastOpen(false);
            onSaved?.();
            onClose();
        }, 800);
    }

    if (!open) return null;

    return (
        <>
            <div className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-[1px]" />

            <div className="fixed inset-0 z-[81] flex items-center justify-center px-4">
                <form
                    onSubmit={handleSubmit}
                    className="w-full max-w-[670px] rounded-[28px] bg-white px-6 py-7 shadow-2xl"
                >
                    <div className="text-[20px] font-extrabold text-slate-900">프로필 설정</div>

                    <div className="mt-8 text-[14px] font-bold text-slate-800">닉네임</div>
                    <input
                        value={nickname}
                        onChange={(e) => {
                            setNickname(e.target.value);
                            if (nicknameError) setNicknameError("");
                        }}
                        placeholder="닉네임"
                        className="mt-2 h-14 w-full rounded-2xl border border-slate-200 px-4 text-[16px] outline-none"
                    />
                    <div className="mt-2 space-y-1 text-[13px] leading-6 text-slate-500">
                        {/* (줍줍) DAD 오픈채팅 닉네임 안내 제거 — 원본 문구 주석 보존:
                            "- 디스카운트 올데이 오픈채팅방과 동일한 닉네임으로 입력해주세요."
                            "- 하단의 오픈채팅방 버튼에서 확인하실 수 있습니다." */}
                        <div>- 스토어에서 사용할 닉네임을 입력해 주세요.</div>
                    </div>
                    {nicknameError ? (
                        <div className="mt-2 text-[13px] font-semibold text-rose-600">{nicknameError}</div>
                    ) : null}

                    {/* (줍줍) DAD 오픈채팅방 확인 버튼 제거 — 주석 보존:
                    <button type="button" onClick={handleOpenChat}
                        className="mt-5 flex h-16 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-[16px] font-extrabold text-slate-800">
                        오픈채팅방에서 닉네임 확인하기
                    </button> */}

                    <div className="mt-7 text-[14px] font-bold text-slate-800">전화번호</div>
                    <input
                        value={phone}
                        onChange={(e) => {
                            setPhone(normalizePhone(e.target.value));
                            if (phoneError) setPhoneError("");
                        }}
                        inputMode="tel"
                        placeholder="연락처('-' 없이)"
                        className="mt-2 h-14 w-full rounded-2xl border border-slate-200 px-4 text-[16px] outline-none"
                    />
                    <div className="mt-2 text-[13px] leading-6 text-slate-500">
                        - 주문·배송 안내에 사용됩니다.
                    </div>
                    {phoneError ? (
                        <div className="mt-2 text-[13px] font-semibold text-rose-600">{phoneError}</div>
                    ) : null}

                    {/* (줍줍) 추천인 닉네임 필드 제거 — 원본 주석 보존.
                        사유: 줍줍 크루/정산 귀속은 링크 기반 zpzp_referral_attribution이 단일 진실원.
                        이 필드는 member.reference(자유텍스트)에만 기록되고 귀속 로직에 미연결이라,
                        유지 시 "닉네임 추천인 vs 링크 귀속" 이중 소스 오해만 유발함.
                    <div className="mt-7 text-[14px] font-bold text-slate-800">
                        추천인 닉네임 <span className="font-medium text-slate-400">(선택)</span>
                    </div>
                    <input value={recommenderNickname} onChange={(e) => setRecommenderNickname(e.target.value)}
                        placeholder="추천해준 친구의 닉네임"
                        className="mt-2 h-14 w-full rounded-2xl border border-slate-200 px-4 text-[16px] outline-none" />
                    <div className="mt-2 text-[13px] leading-6 text-slate-500">
                        - 디스카운트 올데이를 추천해줬다면 추천인의 닉네임을 입력해주세요.
                    </div> */}

                    <div className="mt-8 grid grid-cols-[1fr_1fr] gap-3">
                        <button
                            type="button"
                            onClick={handleLater}
                            className="h-16 rounded-2xl border border-slate-200 bg-white text-[18px] font-extrabold text-slate-800"
                        >
                            다음에
                        </button>
                        <button
                            type="submit"
                            className="h-16 rounded-2xl text-[18px] font-extrabold text-white"
                            style={{ background: "var(--accent)" }}
                        >
                            저장
                        </button>
                    </div>
                </form>
            </div>

            <BottomToast
                open={toastOpen}
                message={toastMessage}
                tone={toastTone}
                onClose={() => setToastOpen(false)}
            />
        </>
    );
}
