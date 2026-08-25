// 셀러 셸(좌측 메뉴)은 유지한 채, 우측 콘텐츠만 권한 안내.
export default function SellerForbiddenMenu({
    menuLabel,
}: {
    menuLabel?: string;
}) {
    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Access
                </div>
                <h1 className="mt-3 text-xl font-extrabold text-slate-900">
                    권한이 없는 메뉴입니다
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                    {menuLabel
                        ? `「${menuLabel}」 메뉴에 대한 접근 권한이 없습니다.`
                        : "이 메뉴에 대한 접근 권한이 없습니다."}
                    <br />
                    왼쪽에서 사용 가능한 메뉴를 선택해 주세요.
                </p>
            </div>
        </div>
    );
}
