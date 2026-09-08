"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { claimPhotoSrc, endpoints, tenantHeader } from "@/lib/api/endpoints";

type ClaimListItem = {
    uid: number;
    orderNum: string;
    title: string;
    optionName?: string;
    kind: "return" | "exchange";
    cause: string;
    reasonLabel: string;
    statusLabel: string;
    photos: string[];
    canWithdraw: boolean;
    createdAt?: string | null;
};

function formatDate(value?: string | null) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
}

export default function ClaimsPage() {
    const params = useParams<{ tenant: string }>();
    const tenant = String(params?.tenant ?? "").trim();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [items, setItems] = useState<ClaimListItem[]>([]);

    const load = useCallback(async () => {
        if (!tenant) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch(endpoints.claimList(tenant), {
                credentials: "include",
                cache: "no-store",
                headers: { Accept: "application/json", ...tenantHeader(tenant) },
            });
            const json = (await res.json().catch(() => null)) as {
                ok?: boolean;
                items?: ClaimListItem[];
                message?: string;
            } | null;
            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || "신청 내역을 불러오지 못했습니다.");
            }
            setItems(json.items || []);
        } catch (e: any) {
            setError(e?.message || "신청 내역을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }, [tenant]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <main className="mx-auto w-full max-w-[520px] px-4 pb-24 pt-3">
            <div className="mb-3 flex items-end justify-between">
                <div>
                    <h1 className="text-[18px] font-extrabold text-slate-900">반품·교환 신청</h1>
                    <p className="mt-1 text-[13px] font-semibold text-slate-500">
                        접수·회수·완료 상태를 여기서 확인할 수 있습니다.
                    </p>
                </div>
                <Link
                    href={`/${tenant}/orders`}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-extrabold text-slate-600"
                >
                    주문내역
                </Link>
            </div>

            {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500">
                    불러오는 중입니다.
                </div>
            ) : error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm font-semibold text-rose-700">
                    {error}
                </div>
            ) : items.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500">
                    반품·교환 신청 내역이 없습니다.
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map((item) => (
                        <Link
                            key={item.uid}
                            href={`/${tenant}/claims/${item.uid}`}
                            className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-[12px] font-extrabold text-slate-500">
                                        {item.kind === "exchange" ? "교환" : "반품"} ·{" "}
                                        {item.cause === "defect" ? "하자" : "변심"}
                                    </div>
                                    <div className="mt-1 text-[15px] font-extrabold text-slate-900">
                                        {item.title}
                                    </div>
                                    {item.optionName ? (
                                        <div className="mt-0.5 text-[12px] font-semibold text-slate-500">
                                            {item.optionName}
                                        </div>
                                    ) : null}
                                </div>
                                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-extrabold text-slate-700">
                                    {item.statusLabel}
                                </span>
                            </div>
                            <div className="mt-2 text-[12px] font-semibold text-slate-600">
                                {item.reasonLabel || "사유 미기재"}
                            </div>
                            <div className="mt-1 text-[11px] font-semibold text-slate-400">
                                {item.orderNum} · {formatDate(item.createdAt)}
                            </div>
                            {item.photos?.[0] ? (
                                <img
                                    src={claimPhotoSrc(item.photos[0])}
                                    alt=""
                                    className="mt-2 h-16 w-16 rounded-lg object-cover"
                                />
                            ) : null}
                        </Link>
                    ))}
                </div>
            )}
        </main>
    );
}
