"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { endpoints, tenantHeader } from "@/lib/api/endpoints";
import { getStorefrontHref } from "@/lib/storefront/storefrontHref";

type CouponStatus = "available" | "used" | "expired";

type MemberCouponItem = {
    couponUid: number;
    name: string;
    kind: "normal" | "welcome";
    couponTypeLabel: string;
    discountLabel: string;
    minOrder: number;
    minOrderLabel: string;
    issuedAt: string | null;
    endDate: string | null;
    status: CouponStatus;
    statusLabel: string;
    usedAt: string | null;
    goodsUid: number | null;
    goodsName: string | null;
};

type CouponsResponse = {
    ok?: boolean;
    items?: MemberCouponItem[];
    counts?: Record<CouponStatus, number>;
    msg?: string;
};

const TABS: { key: CouponStatus; label: string }[] = [
    { key: "available", label: "사용가능" },
    { key: "used", label: "사용완료" },
    { key: "expired", label: "기간만료" },
];

function statusBadgeClass(status: CouponStatus) {
    if (status === "available") {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (status === "used") {
        return "border-slate-200 bg-slate-100 text-slate-600";
    }
    return "border-rose-200 bg-rose-50 text-rose-600";
}

export default function CouponsClient({
    tenant,
    requestHost = "",
}: {
    tenant: string;
    requestHost?: string;
}) {
    const [tab, setTab] = useState<CouponStatus>("available");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [items, setItems] = useState<MemberCouponItem[]>([]);
    const [counts, setCounts] = useState<Record<CouponStatus, number>>({
        available: 0,
        used: 0,
        expired: 0,
    });

    const goodsHref = useCallback(
        (goodsUid: number) =>
            getStorefrontHref(tenant, `goods/${goodsUid}`, undefined, requestHost),
        [tenant, requestHost]
    );

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(endpoints.myCoupons(tenant, { status: tab }), {
                cache: "no-store",
                credentials: "include",
                headers: tenantHeader(tenant),
            });
            const data = (await res.json()) as CouponsResponse;
            if (!res.ok || !data.ok) {
                setError(data.msg || "쿠폰 목록을 불러오지 못했습니다.");
                setItems([]);
                return;
            }
            setItems(Array.isArray(data.items) ? data.items : []);
            setCounts(
                data.counts ?? {
                    available: 0,
                    used: 0,
                    expired: 0,
                }
            );
        } catch {
            setError("쿠폰 목록을 불러오지 못했습니다.");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [tenant, tab]);

    useEffect(() => {
        if (tenant) load();
    }, [tenant, load]);

    const emptyMessage = useMemo(() => {
        if (tab === "available") return "사용 가능한 쿠폰이 없습니다.";
        if (tab === "used") return "사용 완료된 쿠폰이 없습니다.";
        return "기간이 만료된 쿠폰이 없습니다.";
    }, [tab]);

    return (
        <div className="pb-8">
            <div className="text-center text-[16px] font-extrabold text-slate-900">내 쿠폰</div>

            <div className="mt-4 grid grid-cols-3 gap-2">
                {TABS.map((t) => {
                    const active = tab === t.key;
                    const count = counts[t.key] ?? 0;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={[
                                "rounded-xl border px-2 py-3 text-[13px] font-extrabold transition-colors",
                                active
                                    ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]"
                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                            ].join(" ")}
                        >
                            {t.label}
                            <span className="mt-1 block text-[11px] font-semibold opacity-80">
                                {count}장
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-5 text-amber-900">
                주문 결제 시 쿠폰 적용 기능은 준비 중입니다. 보유 쿠폰은 여기서 확인할 수 있습니다.
            </div>

            {loading ? (
                <div className="mt-8 text-center text-[13px] text-slate-500">불러오는 중...</div>
            ) : error ? (
                <div className="mt-8 text-center text-[13px] text-rose-500">{error}</div>
            ) : items.length === 0 ? (
                <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-[13px] text-slate-500">
                    {emptyMessage}
                </div>
            ) : (
                <div className="mt-4 space-y-3">
                    {items.map((item) => (
                        <article
                            key={item.couponUid}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                                <div className="min-w-0">
                                    <div className="text-[12px] font-semibold text-slate-500">
                                        {item.couponTypeLabel}
                                        {item.kind === "welcome" ? " · 웰컴머니" : ""}
                                    </div>
                                    <div className="mt-1 truncate text-[15px] font-extrabold text-slate-900">
                                        {item.name}
                                    </div>
                                </div>
                                <span
                                    className={[
                                        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-extrabold",
                                        statusBadgeClass(item.status),
                                    ].join(" ")}
                                >
                                    {item.statusLabel}
                                </span>
                            </div>

                            <div className="px-4 py-3">
                                <div className="text-[22px] font-extrabold tracking-tight text-[color:var(--brand)]">
                                    {item.discountLabel}
                                </div>
                                {item.minOrderLabel ? (
                                    <div className="mt-1 text-[12px] text-slate-600">
                                        {item.minOrderLabel}
                                    </div>
                                ) : null}
                                {item.goodsUid && item.goodsName ? (
                                    <div className="mt-2 text-[12px] text-slate-600">
                                        적용상품:{" "}
                                        <Link
                                            href={goodsHref(item.goodsUid)}
                                            className="font-semibold text-[color:var(--brand)] underline-offset-2 hover:underline"
                                        >
                                            {item.goodsName}
                                        </Link>
                                    </div>
                                ) : null}
                                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                    {item.issuedAt && item.endDate ? (
                                        <span>
                                            유효기간 {item.issuedAt} ~ {item.endDate}
                                        </span>
                                    ) : item.endDate ? (
                                        <span>~ {item.endDate} 까지</span>
                                    ) : null}
                                    {item.usedAt ? <span>사용일 {item.usedAt}</span> : null}
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
