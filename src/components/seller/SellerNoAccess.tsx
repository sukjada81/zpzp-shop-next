// src/components/seller/SellerNoAccess.tsx
"use client";

export default function SellerNoAccess({ tenant }: { tenant: string }) {
    async function handleLogout() {
        await fetch(`/auth/logout?tenant=${encodeURIComponent(tenant)}`, { method: "POST", credentials: "include" });
        window.location.href = `/auth/kakao/login?tenant=${encodeURIComponent(tenant)}`;
    }

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="mb-4 flex items-center justify-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl">
                        🔒
                    </span>
                </div>
                <h1 className="mb-2 text-center text-lg font-semibold text-slate-800">
                    셀러 권한이 필요합니다
                </h1>
                <p className="mb-6 text-center text-sm text-slate-500">
                    로그인은 완료되었습니다.
                    <br />
                    현재 이 지점의 셀러 권한 승인이 필요합니다.
                    <br />
                    관리자 승인 후 다시 접속해 주세요.
                </p>
                <button
                    onClick={handleLogout}
                    className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
                >
                    로그아웃
                </button>
            </div>
        </div>
    );
}
