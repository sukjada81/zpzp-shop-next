// src/app/(seller)/seller/page.tsx
export default function SellerRootPage() {
    return (
        <div className="min-h-screen bg-[#EEF2F8]">
            <div className="mx-auto flex min-h-screen max-w-[720px] items-center justify-center px-6">
                <div className="w-full rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                    <div className="text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                        셀러 페이지
                    </div>
                    <div className="mt-3 text-sm leading-6 text-slate-500">
                        현재 선택된 지점 경로가 없습니다.
                        <br />
                        올바른 지점 URL로 접속해 주세요.
                    </div>

                    <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                        예시: <span className="font-semibold">/a</span>,{" "}
                        <span className="font-semibold">/b</span>
                    </div>
                </div>
            </div>
        </div>
    );
}