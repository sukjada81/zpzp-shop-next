// src/components/seller/SellerMemberDetailClient.tsx
"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
    ArrowLeft,
    CalendarDays,
    LogIn,
    Mail,
    MapPin,
    Phone,
    User,
    UserCircle2,
} from "lucide-react";
import { getSellerHref } from "@/lib/seller/getSellerHref";

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

function memberStatusBadge(status: string) {
    if (status === "active") {
        return { label: "활성", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" };
    }
    if (status === "inactive" || status === "banned") {
        return { label: "비활성", cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-200" };
    }
    return { label: status || "-", cls: "bg-slate-100 text-slate-600 ring-1 ring-slate-200" };
}

function InfoRow({
    label,
    value,
    icon: Icon,
    span2,
}: {
    label: string;
    value?: string | null;
    icon?: LucideIcon;
    span2?: boolean;
}) {
    return (
        <div className={span2 ? "sm:col-span-2" : undefined}>
            <div className="text-xs font-semibold text-slate-500">{label}</div>
            <div className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-900">
                {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" />}
                <span>{value || "-"}</span>
            </div>
        </div>
    );
}

export default function SellerMemberDetailClient({
    item,
    tenant,
}: {
    item: SellerMemberDetail;
    tenant: string;
}) {
    const badge = memberStatusBadge(item.status);
    const hasAddress = !!(item.postcode || item.address1 || item.address2);
    const address = [item.address1, item.address2].filter(Boolean).join(" ");

    return (
        <div className="space-y-5">
            {/* 헤더 */}
            <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Seller Member
                    </div>
                    <div className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                        회원 상세
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                        가입 회원의 기본 정보를 확인합니다.
                    </div>
                </div>
                <Link
                    href={getSellerHref(tenant, "/members")}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                    <ArrowLeft className="h-4 w-4" />
                    목록
                </Link>
            </div>

            {/* 기본 정보 */}
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="mb-4 text-base font-bold tracking-[-0.02em] text-slate-900">
                    기본 정보
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <InfoRow label="회원명" value={item.name} icon={UserCircle2} />
                    <InfoRow label="아이디" value={item.loginId} icon={User} />
                    <InfoRow label="추천인" value={item.referrer} />
                    <div>
                        <div className="text-xs font-semibold text-slate-500">상태</div>
                        <div className="mt-1.5">
                            <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}
                            >
                                {badge.label}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 연락처 */}
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="mb-4 text-base font-bold tracking-[-0.02em] text-slate-900">
                    연락처
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <InfoRow label="휴대폰번호" value={item.phone} icon={Phone} />
                    <InfoRow label="일반전화" value={item.tel} icon={Phone} />
                    <InfoRow label="이메일" value={item.email} icon={Mail} span2 />
                </div>
            </div>

            {/* 주소 (데이터 있을 때만) */}
            {hasAddress && (
                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                    <div className="mb-4 text-base font-bold tracking-[-0.02em] text-slate-900">
                        주소
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <InfoRow label="우편번호" value={item.postcode} icon={MapPin} />
                        <InfoRow label="주소" value={address || undefined} icon={MapPin} span2 />
                    </div>
                </div>
            )}

            {/* 가입 정보 */}
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="mb-4 text-base font-bold tracking-[-0.02em] text-slate-900">
                    가입 정보
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <InfoRow label="가입일" value={formatDateTime(item.joinedAt)} icon={CalendarDays} />
                    <InfoRow
                        label="최근 로그인"
                        value={formatDateTime(item.lastLoginAt)}
                        icon={LogIn}
                    />
                </div>
            </div>

            {/* 메모 */}
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="mb-3 text-base font-bold tracking-[-0.02em] text-slate-900">메모</div>
                <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                    {item.memo?.trim() ? item.memo : "등록된 메모가 없습니다."}
                </div>
            </div>
        </div>
    );
}
