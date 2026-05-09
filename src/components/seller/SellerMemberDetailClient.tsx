// src/components/seller/SellerMemberDetailClient.tsx
"use client";

export type SellerMemberDetail = {
    id: string;
    memberUid: string;
    loginId: string;
    name: string;
    tel?: string;
    phone: string;
    email?: string;
    postcode?: string;
    address1?: string;
    address2?: string;
    memo?: string;
    referrer?: string;
    status: string;
    primaryRole?: string;
    joinedAt: string;
    lastLoginAt: string;
};

function formatDateTime(value?: string) {
    if (!value) return "-";

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;

    return d.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function SellerMemberDetailClient({
                                                     item,
                                                 }: {
    item: SellerMemberDetail;
}) {
    return (
        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
                <div className="text-2xl font-extrabold text-slate-900">회원 상세</div>
                <div className="mt-1 text-sm text-slate-500">
                    가입 회원의 기본 정보와 상태를 확인합니다.
                </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div>
                    <span className="font-semibold">회원명</span> : {item.name || "-"}
                </div>
                <div>
                    <span className="font-semibold">회원 UID</span> : {item.memberUid || "-"}
                </div>
                <div>
                    <span className="font-semibold">로그인 아이디</span> : {item.loginId || "-"}
                </div>
                <div>
                    <span className="font-semibold">휴대폰번호</span> : {item.phone || "-"}
                </div>
                <div>
                    <span className="font-semibold">일반전화</span> : {item.tel || "-"}
                </div>
                <div>
                    <span className="font-semibold">이메일</span> : {item.email || "-"}
                </div>
                <div>
                    <span className="font-semibold">우편번호</span> : {item.postcode || "-"}
                </div>
                <div>
                    <span className="font-semibold">주소</span> :{" "}
                    {[item.address1, item.address2].filter(Boolean).join(" ") || "-"}
                </div>
                <div>
                    <span className="font-semibold">추천인</span> : {item.referrer || "-"}
                </div>
                <div>
                    <span className="font-semibold">대표 역할</span> : {item.primaryRole || "-"}
                </div>
                <div>
                    <span className="font-semibold">가입일</span> : {formatDateTime(item.joinedAt)}
                </div>
                <div>
                    <span className="font-semibold">최근 로그인</span> : {formatDateTime(item.lastLoginAt)}
                </div>
                <div>
                    <span className="font-semibold">상태</span> : {item.status || "-"}
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 text-sm">
                <div className="mb-2 font-semibold text-slate-900">메모</div>
                <div className="whitespace-pre-wrap text-slate-700">
                    {item.memo?.trim() ? item.memo : "등록된 메모가 없습니다."}
                </div>
            </div>
        </div>
    );
}