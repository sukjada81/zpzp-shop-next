"use client";

import { useEffect, useState } from "react";

type Member = {
    id: string;
    name: string;
    phone: string;
    status: string;
    joinedAt: string;
    lastLoginAt: string;
};

export default function SellerMemberDetailClient({
                                                     tenant,
                                                     id,
                                                 }: {
    tenant: string;
    id: string;
}) {
    const [item, setItem] = useState<Member | null>(null);

    useEffect(() => {
        (async () => {
            const res = await fetch(`/api/seller/${tenant}/members/${id}`, {
                cache: "no-store",
            });

            const json = await res.json();
            setItem(json.item);
        })();
    }, [tenant, id]);

    if (!item) return <div className="p-6">Loading...</div>;

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