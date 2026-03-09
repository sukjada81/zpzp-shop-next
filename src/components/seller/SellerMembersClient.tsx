// src/components/seller/SellerMembersClient.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Users, Search } from "lucide-react";
import { getSellerHref } from "@/lib/seller/getSellerHref";

export type SellerMemberItem = {
    id: string;
    name: string;
    phone: string;
    status: string;
    joinedAt: string;
    lastLoginAt: string;
};

export default function SellerMembersClient({
                                                tenant,
                                                items,
                                                keyword = "",
                                            }: {
    tenant: string;
    items: SellerMemberItem[];
    keyword?: string;
}) {
    const filtered = useMemo(() => {
        const q = keyword.trim().toLowerCase();
        if (!q) return items;

        return items.filter((m) => {
            return (
                m.name.toLowerCase().includes(q) ||
                m.phone.toLowerCase().includes(q)
            );
        });
    }, [items, keyword]);

    return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <div className="text-2xl font-extrabold text-slate-900">회원 관리</div>
                    <div className="text-sm text-slate-500">
                        지점 가입 회원을 조회합니다.
                    </div>
                </div>

                <Users className="h-6 w-6 text-slate-400" />
            </div>

            <div className="mb-4 flex items-center gap-2 rounded-xl border px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                    defaultValue={keyword}
                    placeholder="회원명 / 전화번호 검색"
                    className="flex-1 text-sm outline-none"
                    onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        const value = (e.target as HTMLInputElement).value.trim();
                        const url = value
                            ? `${getSellerHref(tenant, "/members")}?q=${encodeURIComponent(value)}`
                            : getSellerHref(tenant, "/members");
                        window.location.href = url;
                    }}
                />
            </div>

            {filtered.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                    등록된 회원이 없습니다.
                </div>
            ) : (
                <table className="w-full overflow-hidden rounded-xl text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                    <tr>
                        <th className="px-4 py-3 text-left">회원명</th>
                        <th className="px-4 py-3 text-left">전화번호</th>
                        <th className="px-4 py-3 text-left">가입일</th>
                        <th className="px-4 py-3 text-left">최근 로그인</th>
                        <th className="px-4 py-3 text-left">상태</th>
                    </tr>
                    </thead>

                    <tbody>
                    {filtered.map((m) => (
                        <tr key={m.id} className="border-t hover:bg-slate-50">
                            <td className="px-4 py-3">
                                <Link
                                    href={getSellerHref(tenant, `/members/${m.id}`)}
                                    className="font-medium text-slate-900 hover:underline"
                                >
                                    {m.name}
                                </Link>
                            </td>
                            <td className="px-4 py-3">{m.phone}</td>
                            <td className="px-4 py-3">{m.joinedAt}</td>
                            <td className="px-4 py-3">{m.lastLoginAt}</td>
                            <td className="px-4 py-3">{m.status}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}