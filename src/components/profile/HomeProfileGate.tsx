// src/components/profile/HomeProfileGate.tsx
"use client";

import { useEffect, useState } from "react";
import ProfileSetupModal from "@/components/profile/ProfileSetupModal";
import {
    isQuickOrderProfileComplete,
    normalizeQuickOrderPhone,
    readQuickOrderProfile,
    saveQuickOrderProfile,
    shouldOpenProfileSetupModal,
} from "@/lib/profile/quickOrderProfile";

type AuthSession = {
    ok?: boolean;
    loggedIn?: boolean;
    member?: {
        uid?: string | number;
        id?: string;
        name?: string;
        email?: string;
        phone?: string;
        tenantSlug?: string;
    } | null;
};

/**
 * 프로필 설정 모달 게이트.
 *
 * 판정 기준은 **서버(회원 세션)에 저장된 프로필**이다. 예전엔 localStorage 만 보고 판정해서,
 * DB 에 닉네임·휴대폰이 멀쩡히 있어도 다음 경우에 모달이 다시 떴다:
 * 다른 기기·브라우저, 시크릿창, 사이트데이터 삭제, 그리고 **다른 서브도메인**
 * (localStorage 는 origin 별로 갈리므로 링커 스토어를 옮겨다닐 때마다 재노출됐다.
 *  세션 쿠키는 .zpzp.kr 로 공유되는데 로컬만 안 되니 "로그인은 됐는데 프로필만 또 묻는" 형태).
 *
 * 세션의 name/phone 은 로그인 시 mallRN_member 의 name/cell 스냅샷이고(auth.routes.ts),
 * 프로필 저장(PATCH /v1/public/member/reference)이 DB 와 세션을 함께 갱신한다.
 * 따라서 별도 조회 API 없이 이 응답만으로 판정이 선다.
 *
 * localStorage 는 진실원이 아니라 **보조 캐시**로 강등: 서버에 프로필이 있으면 로컬에 심어
 * 주문서 자동채움 같은 기존 로컬 읽기 경로도 새 기기에서 같이 살아나게 한다.
 */
export default function HomeProfileGate({ tenant }: { tenant: string }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            try {
                const res = await fetch("/auth/session", {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                });

                const data = (await res.json().catch(() => null)) as AuthSession | null;
                if (cancelled) return;

                if (!data?.loggedIn) return;

                // (줍줍) DAD 오픈채팅 안내 제거로 tenant openchatUrl 조회 폐지.
                const serverProfile = {
                    nickname: String(data.member?.name ?? "").trim(),
                    phone: normalizeQuickOrderPhone(data.member?.phone),
                };

                const localProfile = readQuickOrderProfile(tenant);

                // 1) 서버에 프로필이 완성돼 있으면 기기·브라우저·서브도메인과 무관하게 모달을 열지 않는다.
                if (isQuickOrderProfileComplete(serverProfile)) {
                    // 로컬 캐시 동기화. 추천인은 로컬에만 있는 값이라 덮어쓰지 않고 보존한다.
                    saveQuickOrderProfile(tenant, {
                        nickname: serverProfile.nickname,
                        phone: serverProfile.phone,
                        recommenderNickname: localProfile?.recommenderNickname ?? "",
                    });
                    return;
                }

                // 2) 서버엔 없고 로컬에만 완성 프로필이 있는 경우(서버 저장 도입 전에 저장했거나
                //    저장 PATCH 가 실패했던 계정) — 서버로 올려 다음 기기부터 재노출되지 않게 한다.
                //    실패해도 무시(모달 노출 판정은 아래 로컬 기준을 그대로 따른다).
                if (isQuickOrderProfileComplete(localProfile)) {
                    fetch("/api/proxy/v1/public/member/reference", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            nickname: String(localProfile?.nickname ?? "").trim(),
                            phone: normalizeQuickOrderPhone(localProfile?.phone),
                        }),
                    }).catch(() => null);
                }

                if (shouldOpenProfileSetupModal(tenant)) {
                    setOpen(true);
                }
            } catch {
                // ignore
            }
        }

        if (tenant) run();

        return () => {
            cancelled = true;
        };
    }, [tenant]);

    return (
        <ProfileSetupModal
            open={open}
            tenant={tenant}
            onClose={() => setOpen(false)}
            onSaved={() => setOpen(false)}
        />
    );
}
