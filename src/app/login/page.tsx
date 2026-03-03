// src/app/login/page.tsx
"use client";

export default function LoginPage() {
    const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;

    // ✅ auth 도메인 로그인 페이지 기본 returnTo:
    // - returnTo가 없으면 main의 /select-tenant로 보내는 게 정답
    const defaultReturnTo =
        (process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://discountallday.kr") + "/select-tenant";

    const returnTo = sp?.get("returnTo") || defaultReturnTo;

    // tenant는 선택적으로만 받음(바로 특정 지점으로 보낼 때 쓰고, 기본 플로우는 tenant 없음)
    const tenant = sp?.get("tenant") || "";

    return (
        <main className="min-h-dvh flex flex-col items-center justify-center px-6">
            <div className="w-full max-w-[420px] flex flex-col items-center">
                <div className="mb-6 text-center">
                    <div className="text-xl font-extrabold tracking-wide">매장 로그인</div>
                    <div className="mt-2 text-sm text-slate-500">카카오 계정으로 간편하게 시작하세요.</div>
                </div>

                <div className="w-full rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-sm text-slate-700 leading-6">
                        <div>• 필수 · 선택 모두 동의해야</div>
                        <div>• 픽업 안내 알림을 받을 수 있습니다.</div>
                    </div>
                </div>

                <button
                    type="button"
                    className="mt-5 w-full rounded-xl bg-[var(--kakao)] py-4 font-bold text-black shadow-sm active:scale-[0.99]"
                    onClick={() => {
                        const qs =
                            `tenant=${encodeURIComponent(tenant)}` +
                            `&returnTo=${encodeURIComponent(returnTo)}` +
                            `&auto=0`;
                        // ✅ auto=1 쓰면 login_required가 자주 뜹니다(세션 없으면 필연).
                        window.location.href = `/api/auth/kakao/login?${qs}`;
                    }}
                >
                    카카오로 시작하기
                </button>

                <p className="mt-3 text-xs text-slate-400 text-center">
                    로그인 시 서비스 이용약관에 동의하는 것으로 간주됩니다.
                </p>

                <div className="mt-14 w-full border-t pt-8 text-center text-xs text-slate-400">
                    © 2026. All rights reserved.
                </div>
            </div>
        </main>
    );
}