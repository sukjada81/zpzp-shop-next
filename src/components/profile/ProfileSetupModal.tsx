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
}) {
    const [nickname, setNickname] = useState("");
    const [phone, setPhone] = useState("");
    const [recommenderNickname, setRecommenderNickname] = useState("");
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastTone, setToastTone] = useState<BottomToastTone>("success");

    useEffect(() => {
        if (!open) return;

        const profile = readQuickOrderProfile(tenant);
        setNickname(String(profile?.nickname ?? ""));
        setPhone(String(profile?.phone ?? ""));
        setRecommenderNickname(String(profile?.recommenderNickname ?? ""));
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

    function handleOpenChat() {
        const openChatUrl = process.env.NEXT_PUBLIC_OPENCHAT_URL || "";
        if (openChatUrl) {
            window.open(openChatUrl, "_blank", "noopener,noreferrer");
            return;
        }
        showToast("오픈채팅 링크는 추후 연결 예정입니다.", "error");
    }

    function handleSave() {
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

        saveQuickOrderProfile(tenant, {
            nickname: normalizedNickname,
            phone: normalizedPhone,
            recommenderNickname: recommenderNickname.trim(),
        });

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
                <div className="w-full max-w-[670px] rounded-[28px] bg-white px-6 py-7 shadow-2xl">
                    <div className="text-[20px] font-extrabold text-slate-900">프로필 설정</div>

                    <div className="mt-8 text-[14px] font-bold text-slate-800">닉네임</div>
                    <input
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="닉네임"
                        className="mt-2 h-14 w-full rounded-2xl border border-slate-200 px-4 text-[16px] outline-none"
                    />
                    <div className="mt-2 space-y-1 text-[13px] leading-6 text-slate-500">
                        <div>- 다이클로 용산해링턴스퀘어점 오픈채팅방과 동일한 닉네임으로 입력해주세요.</div>
                        <div>- 하단의 오픈채팅방 버튼에서 확인하실 수 있습니다.</div>
                    </div>

                    <button
                        type="button"
                        onClick={handleOpenChat}
                        className="mt-5 flex h-16 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-[16px] font-extrabold text-slate-800"
                    >
                        오픈채팅방에서 닉네임 확인하기
                    </button>

                    <div className="mt-7 text-[14px] font-bold text-slate-800">전화번호</div>
                    <input
                        value={phone}
                        onChange={(e) => setPhone(normalizePhone(e.target.value))}
                        inputMode="tel"
                        placeholder="연락처('-' 없이)"
                        className="mt-2 h-14 w-full rounded-2xl border border-slate-200 px-4 text-[16px] outline-none"
                    />
                    <div className="mt-2 text-[13px] leading-6 text-slate-500">
                        - 픽업일 알림톡 발송시 필요합니다.
                    </div>

                    <div className="mt-7 text-[14px] font-bold text-slate-800">
                        추천인 닉네임 <span className="font-medium text-slate-400">(선택)</span>
                    </div>
                    <input
                        value={recommenderNickname}
                        onChange={(e) => setRecommenderNickname(e.target.value)}
                        placeholder="추천해준 친구의 닉네임"
                        className="mt-2 h-14 w-full rounded-2xl border border-slate-200 px-4 text-[16px] outline-none"
                    />
                    <div className="mt-2 text-[13px] leading-6 text-slate-500">
                        - 다이클로를 추천해줬다면 추천인의 닉네임을 입력해주세요.
                    </div>

                    <div className="mt-8 grid grid-cols-[1fr_1fr] gap-3">
                        <button
                            type="button"
                            onClick={handleLater}
                            className="h-16 rounded-2xl border border-slate-200 bg-white text-[18px] font-extrabold text-slate-800"
                        >
                            다음에
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="h-16 rounded-2xl text-[18px] font-extrabold text-white"
                            style={{ background: "var(--accent)" }}
                        >
                            저장
                        </button>
                    </div>
                </div>
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