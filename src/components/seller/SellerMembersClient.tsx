// src/components/seller/SellerMembersClient.tsx
"use client";

import Link from "next/link";
import { Users, Search, UserPlus, LogIn, CalendarDays, UserCircle2 } from "lucide-react";
import { getSellerHref } from "@/lib/seller/getSellerHref";

export type SellerMembersSummary = {
    totalMembers: number;
    todaySignups: number;
    weekSignups: number;
    todayInflows: number;
    todayLogins: number;
    sourceReady: boolean;
};

export type SellerMemberItem = {
    id: string;
    memberUid: string;
    loginId: string;
    name: string;
    phone: string;
    email: string;
    status: string;
    primaryRole: string;
    joinedAt: string;
    lastLoginAt: string;
};

function formatDateTime(value: string) {
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

function summaryCards(summary?: SellerMembersSummary) {
    return [
        {
            key: "totalMembers",
            label: "전체 회원",
            value: Number(summary?.totalMembers ?? 0),
            hint: "지점 가입 회원",
            icon: Users,
        },
        {
            key: "todaySignups",
            label: "오늘 회원가입",
            value: Number(summary?.todaySignups ?? 0),
            hint: "금일 신규 가입",
            icon: UserPlus,
        },
        {
            key: "weekSignups",
            label: "최근 7일 회원가입",
            value: Number(summary?.weekSignups ?? 0),
            hint: "최근 7일 신규 회원",
            icon: CalendarDays,
        },
        {
            key: "todayLogins",
            label: "오늘 로그인",
            value: Number(summary?.todayLogins ?? 0),
            hint: "금일 로그인 회원",
            icon: LogIn,
        },
    ];
}

export default function SellerMembersClient({
                                                tenant,
                                                items,
                                                summary,
                                                keyword = "",
                                            }: {
    tenant: string;
    items: SellerMemberItem[];
    summary?: SellerMembersSummary;
    keyword?: string;
}) {
    const cards = summaryCards(summary);

    return (
        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-2xl font-extrabold text-slate-900">회원 관리</div>
                    <div className="text-sm text-slate-500">
                        지점 가입 회원 현황과 상세 정보를 확인합니다.
                    </div>
                </div>

                <Users className="h-6 w-6 text-slate-400" />
            </div>

            <div className="grid grid-cols-2 gap-3">
                {cards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={card.key}
                            className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                        >
                            <div className="mb-3 flex items-start justify-between gap-3">
                                <div className="text-sm font-semibold text-slate-800">
                                    {card.label}
                                </div>
                                <div className="rounded-2xl bg-white p-2 text-slate-500 shadow-sm">
                                    <Icon className="h-4 w-4" />
                                </div>
                            </div>

                            <div className="flex items-end gap-1">
                                <span className="text-[30px] font-extrabold leading-none tracking-[-0.04em] text-slate-900">
                                    {card.value.toLocaleString("ko-KR")}
                                </span>
                                <span className="pb-0.5 text-sm font-semibold text-slate-600">명</span>
                            </div>

                            <div className="mt-2 text-xs text-slate-500">{card.hint}</div>
                        </div>
                    );
                })}
            </div>

            <form
                action={getSellerHref(tenant, "/members")}
                method="get"
                className="flex items-center gap-2 rounded-xl border px-3 py-2"
            >
                <Search className="h-4 w-4 text-slate-400" />
                <input
                    name="q"
                    defaultValue={keyword}
                    placeholder="회원명 / 아이디 / 전화번호 / 이메일 검색"
                    className="flex-1 text-sm outline-none"
                />
                <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                    검색
                </button>
            </form>

            {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-slate-400">
                    등록된 회원이 없습니다.
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 text-left">회원명</th>
                            <th className="px-4 py-3 text-left">아이디</th>
                            <th className="px-4 py-3 text-left">전화번호</th>
                            <th className="px-4 py-3 text-left">이메일</th>
                            <th className="px-4 py-3 text-left">가입일</th>
                            <th className="px-4 py-3 text-left">최근 로그인</th>
                            <th className="px-4 py-3 text-left">상태</th>
                        </tr>
                        </thead>

                        <tbody>
                        {items.map((m) => (
                            <tr key={`${m.memberUid}-${m.id}`} className="border-t hover:bg-slate-50">
                                <td className="px-4 py-3">
                                    <Link
                                        href={getSellerHref(tenant, `/members/${m.memberUid}`)}
                                        className="inline-flex items-center gap-2 font-medium text-slate-900 hover:underline"
                                    >
                                        <UserCircle2 className="h-4 w-4 text-slate-400" />
                                        {m.name || "-"}
                                    </Link>
                                </td>
                                <td className="px-4 py-3 text-slate-700">{m.loginId || "-"}</td>
                                <td className="px-4 py-3 text-slate-700">{m.phone || "-"}</td>
                                <td className="px-4 py-3 text-slate-700">{m.email || "-"}</td>
                                <td className="px-4 py-3 text-slate-700">{formatDateTime(m.joinedAt)}</td>
                                <td className="px-4 py-3 text-slate-700">{formatDateTime(m.lastLoginAt)}</td>
                                <td className="px-4 py-3 text-slate-700">{m.status || "-"}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}