// src/app/login/page.tsx
"use client";

function getTenantFromHost(host: string) {
    const h = (host || "").toLowerCase().split(":")[0];
    if (!h) return "";

    // allow seller01.localhost for local dev
    if (h.endsWith(".localhost")) {
        const sub = h.split(".")[0];
        if (["www", "admin", "auth", "api"].includes(sub)) return "";
        return sub;
    }

    // ignore localhost / ip
    if (h === "localhost") return "";
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return "";

    const parts = h.split(".");
    if (parts.length < 3) return "";

    const sub = parts[0];
    if (["www", "admin", "auth", "api"].includes(sub)) return "";

    return sub;
}

export default function LoginPage() {
    const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;

    // 1) returnTo: 서브도메인 방식 기본은 /home 이 자연스러움
    const returnTo = sp?.get("returnTo") || "/home";

    // 2) tenant: 쿼리 우선, 없으면 Host에서 추출
    const tenantFromQuery = sp?.get("tenant") || "";
    const tenantFromHost = typeof window !== "undefined" ? getTenantFromHost(window.location.host) : "";
    const tenant = tenantFromQuery || tenantFromHost;

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
                        // tenant가 비어있으면(예: localhost 접속) 기존 플로우 유지 가능
                        const qs =
                            `tenant=${encodeURIComponent(tenant)}` +
                            `&returnTo=${encodeURIComponent(returnTo)}` +
                            `&auto=1`;

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