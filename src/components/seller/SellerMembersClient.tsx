// src/components/seller/SellerMembersClient.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Search } from "lucide-react";
import { getSellerHref } from "@/lib/seller/getSellerHref";

type Member = {
    id: string;
    name: string;
    phone: string;
    status: string;
    joinedAt: string;
    lastLoginAt: string;
};

type MembersResponse = {
    ok: boolean;
    summary?: {
        todaySignups: number;
        weekSignups: number;
        todayInflows: number;
        todayLogins: number;
        sourceReady: boolean;
    };
    items?: Member[];
};

export default function SellerMembersClient({ tenant }: { tenant: string }) {
    const [items, setItems] = useState<Member[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        (async () => {
            try {
                setError("");

                const res = await fetch(`/api/seller/${tenant}/members`, {
                    cache: "no-store",
                });

                const contentType = res.headers.get("content-type") || "";
                const rawText = await res.text();

                if (!res.ok) {
                    throw new Error(`회원 API 요청 실패 (${res.status})`);
                }

                if (!contentType.includes("application/json")) {
                    console.error("members api non-json response:", rawText);
                    throw new Error("회원 API가 JSON이 아닌 응답을 반환했습니다.");
                }

                const json = JSON.parse(rawText) as MembersResponse;

                if (!active) return;
                setItems(Array.isArray(json?.items) ? json.items : []);
            } catch (e: any) {
                console.error(e);
                if (active) {
                    setError(e?.message || "회원 목록을 불러오지 못했습니다.");
                    setItems([]);
                }
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [tenant]);

    const filtered = items.filter((m) => {
        const q = query.toLowerCase();
        return (
            m.name.toLowerCase().includes(q) ||
            m.phone.toLowerCase().includes(q)
        );
    });

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
                    placeholder="회원명 / 전화번호 검색"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 text-sm outline-none"
                />
            </div>

            {loading && (
                <div className="py-10 text-center text-slate-400">
                    회원 목록 불러오는 중...
                </div>
            )}

            {!loading && error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                    {error}
                </div>
            )}

            {!loading && !error && filtered.length === 0 && (
                <div className="py-10 text-center text-slate-400">
                    등록된 회원이 없습니다.
                </div>
            )}

            {!loading && !error && filtered.length > 0 && (
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
                        <tr
                            key={m.id}
                            className="border-t hover:bg-slate-50"
                        >
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