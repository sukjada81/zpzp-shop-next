// src/components/seller/SellerMemberDetailClient.tsx
"use client";

export type SellerMemberDetail = {
    id: string;
    name: string;
    phone: string;
    status: string;
    joinedAt: string;
    lastLoginAt: string;
};

export default function SellerMemberDetailClient({
                                                     item,
                                                 }: {
    item: SellerMemberDetail;
}) {
    return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="text-2xl font-extrabold text-slate-900">
                회원 상세
            </div>

            <div className="grid gap-3 text-sm">
                <div>
                    <span className="font-semibold">이름</span> : {item.name}
                </div>

                <div>
                    <span className="font-semibold">전화번호</span> : {item.phone}
                </div>

                <div>
                    <span className="font-semibold">가입일</span> : {item.joinedAt}
                </div>

                <div>
                    <span className="font-semibold">최근 로그인</span> : {item.lastLoginAt}
                </div>

                <div>
                    <span className="font-semibold">상태</span> : {item.status}
                </div>
            </div>
        </div>
    );
}