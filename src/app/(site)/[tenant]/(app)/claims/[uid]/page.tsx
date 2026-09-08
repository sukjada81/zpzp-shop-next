"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { claimPhotoSrc, endpoints, tenantHeader } from "@/lib/api/endpoints";

type ClaimDetail = {
    uid: number;
    orderNum: string;
    orderGoodsUid: number;
    title: string;
    optionName?: string;
    kind: "return" | "exchange";
    cause: string;
    reasonLabel: string;
    statusLabel: string;
    photos: string[];
    detail: string;
    reason: string;
    canWithdraw: boolean;
    createdAt?: string | null;
};

function formatDate(value?: string | null) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
}

export default function ClaimDetailPage() {
    const params = useParams<{ tenant: string; uid: string }>();
    const router = useRouter();
    const tenant = String(params?.tenant ?? "").trim();
    const uid = String(params?.uid ?? "").trim();
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [item, setItem] = useState<ClaimDetail | null>(null);

    const load = useCallback(async () => {
        if (!tenant || !uid) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch(endpoints.claimDetail(tenant, uid), {
                credentials: "include",
                cache: "no-store",
                headers: { Accept: "application/json", ...tenantHeader(tenant) },
            });
            const json = (await res.json().catch(() => null)) as {
                ok?: boolean;
                item?: ClaimDetail;
                message?: string;
            } | null;
            if (!res.ok || !json?.ok || !json.item) {
                throw new Error(json?.message || "신청 내역이 없습니다.");
            }
            setItem(json.item);
        } catch (e: any) {
            setError(e?.message || "신청 내역이 없습니다.");
            setItem(null);
        } finally {
            setLoading(false);
        }
    }, [tenant, uid]);

    useEffect(() => {
        void load();
    }, [load]);

    async function handleWithdraw() {
        if (!item?.canWithdraw || busy) return;
        if (!confirm("이 신청을 철회할까요? 철회하면 이전 주문 상태로 돌아갑니다.")) return;
        setBusy(true);
        try {
            const res = await fetch(
                endpoints.withdrawClaimOrderItem(tenant, item.orderNum, item.orderGoodsUid),
                {
                    method: "POST",
                    credentials: "include",
                    cache: "no-store",
                    headers: { Accept: "application/json", ...tenantHeader(tenant) },
                }
            );
            const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || "철회에 실패했습니다.");
            }
            alert(json.message || "신청이 철회되었습니다.");
            router.replace(`/${tenant}/claims`);
        } catch (e: any) {
            alert(e?.message || "철회 처리 중 오류가 발생했습니다.");
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return (
            <main className="mx-auto max-w-[520px] px-4 pb-24 pt-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500">
                    불러오는 중입니다.
                </div>
            </main>
        );
    }

    if (!item) {
        return (
            <main className="mx-auto max-w-[520px] px-4 pb-24 pt-3">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm font-semibold text-rose-700">
                    {error || "신청 내역이 없습니다."}
                </div>
                <Link
                    href={`/${tenant}/claims`}
                    className="mt-3 flex h-11 items-center justify-center rounded-xl border border-slate-200 text-[13px] font-extrabold text-slate-700"
                >
                    목록으로
                </Link>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-[520px] px-4 pb-24 pt-3">
            <div className="mb-3 flex items-center justify-between">
                <Link
                    href={`/${tenant}/claims`}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-extrabold text-slate-600"
                >
                    목록
                </Link>
                <Link
                    href={`/${tenant}/orders/${encodeURIComponent(item.orderNum)}`}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-extrabold text-slate-600"
                >
                    주문상세
                </Link>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[12px] font-extrabold text-slate-500">
                    {item.kind === "exchange" ? "교환" : "반품"} ·{" "}
                    {item.cause === "defect" ? "하자·오배송" : "단순 변심"}
                </div>
                <div className="mt-1 text-[18px] font-extrabold text-slate-900">{item.title}</div>
                {item.optionName ? (
                    <div className="mt-1 text-[13px] font-semibold text-slate-500">{item.optionName}</div>
                ) : null}
                <div className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[12px] font-extrabold text-slate-700">
                    {item.statusLabel}
                </div>
                <dl className="mt-4 space-y-2 text-[13px] font-semibold text-slate-700">
                    <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">주문번호</dt>
                        <dd>{item.orderNum}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">신청일</dt>
                        <dd>{formatDate(item.createdAt)}</dd>
                    </div>
                    <div>
                        <dt className="text-slate-500">사유</dt>
                        <dd className="mt-1 text-slate-900">{item.reasonLabel || item.reason || "-"}</dd>
                    </div>
                    {item.detail ? (
                        <div>
                            <dt className="text-slate-500">상세 내용</dt>
                            <dd className="mt-1 whitespace-pre-wrap text-slate-900">{item.detail}</dd>
                        </div>
                    ) : null}
                </dl>
                {item.cause === "change_of_mind" ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-semibold leading-5 text-amber-950">
                        변심 반품은 상품이 사용하지 않은 완전한 상태로 돌아와야 합니다. 회수가
                        시작되기 전에는 이 신청을 철회할 수 있습니다.
                    </div>
                ) : null}
                {item.photos?.length ? (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                        {item.photos.map((src) => (
                            <a key={src} href={claimPhotoSrc(src)} target="_blank" rel="noreferrer">
                                <img src={claimPhotoSrc(src)} alt="" className="h-24 w-full rounded-xl object-cover" />
                            </a>
                        ))}
                    </div>
                ) : null}
            </div>

            {item.canWithdraw ? (
                <button
                    type="button"
                    onClick={() => void handleWithdraw()}
                    disabled={busy}
                    className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white text-[14px] font-extrabold text-slate-800 disabled:opacity-50"
                >
                    {busy ? "처리 중..." : "이 신청 철회하기"}
                </button>
            ) : null}
        </main>
    );
}
