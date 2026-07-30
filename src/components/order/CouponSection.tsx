// src/components/order/CouponSection.tsx
// 주문서 쿠폰 선택 섹션 (W-1). 스펙 shop-php/docs/superpowers/specs/2026-07-27-store-coupon-stack-design.md §12
//
// 계약 주의: 할인액 계산·스택 판정의 진실원은 서버다. 이 컴포넌트가 보여주는 금액은 표시용이며,
// 최종 결제액은 toss/prepare 응답의 amount 다. prepare 요청 body.amount 는 '할인 전 상품합계'로 유지한다.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { endpoints, tenantHeader } from "@/lib/api/endpoints";

export type AvailableCoupon = {
    couponUid: number;
    cUid: number;
    name: string;
    kind: "normal" | "welcome";
    discount: number;
    usable: boolean;
    reason: string;
    minOrder: number;
    endDate: string | null;
};

type CouponSectionProps = {
    tenant: string;
    /** 할인 전 상품합계 */
    subtotal: number;
    /** 선택이 바뀔 때마다 (쿠폰 uid 목록, 할인 합계) 를 올려준다 */
    onChange: (couponUids: number[], discountTotal: number) => void;
};

type CouponsResponse = {
    ok?: boolean;
    stackAllowed?: boolean;
    coupons?: AvailableCoupon[];
    msg?: string;
};

function labelOf(c: AvailableCoupon): string {
    if (c.usable) return `${c.name} · -${c.discount.toLocaleString()}원`;
    if (c.reason) return `${c.name} · ${c.reason}`;
    return `${c.name} · 사용불가`;
}

export default function CouponSection({ tenant, subtotal, onChange }: CouponSectionProps) {
    const [coupons, setCoupons] = useState<AvailableCoupon[]>([]);
    const [stackAllowed, setStackAllowed] = useState(true);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState("");

    // 선택 상태: 스택 ON 이면 종류별 1장, OFF 면 single 하나만 쓴다.
    const [normalUid, setNormalUid] = useState(0);
    const [welcomeUid, setWelcomeUid] = useState(0);
    const [singleUid, setSingleUid] = useState(0);

    useEffect(() => {
        let alive = true;
        if (subtotal <= 0) {
            setCoupons([]);
            setLoaded(true);
            return;
        }

        (async () => {
            try {
                const res = await fetch(endpoints.couponsAvailable(tenant, subtotal), {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                    headers: { Accept: "application/json", ...tenantHeader(tenant) },
                });

                if (!alive) return;

                // 비로그인(401)은 오류가 아니라 '쿠폰 없음'으로 조용히 처리한다.
                if (res.status === 401) {
                    setCoupons([]);
                    setLoaded(true);
                    return;
                }

                const data = (await res.json().catch(() => ({}))) as CouponsResponse;
                if (!alive) return;

                if (!res.ok || data?.ok !== true) {
                    setError(data?.msg || "쿠폰 정보를 불러오지 못했습니다.");
                    setCoupons([]);
                    setLoaded(true);
                    return;
                }

                setError("");
                setStackAllowed(data.stackAllowed !== false);
                setCoupons(Array.isArray(data.coupons) ? data.coupons : []);
                setLoaded(true);
            } catch {
                if (!alive) return;
                setError("쿠폰 정보를 불러오지 못했습니다.");
                setCoupons([]);
                setLoaded(true);
            }
        })();

        return () => {
            alive = false;
        };
    }, [tenant, subtotal]);

    const normalCoupons = useMemo(() => coupons.filter((c) => c.kind === "normal"), [coupons]);
    const welcomeCoupons = useMemo(() => coupons.filter((c) => c.kind === "welcome"), [coupons]);

    const findUsable = useCallback(
        (uid: number) => coupons.find((c) => c.couponUid === uid && c.usable),
        [coupons]
    );

    // 상품합계가 바뀌어 최소주문에 걸리면(=usable 이 꺼지면) 선택을 자동 해제한다.
    useEffect(() => {
        if (!loaded) return;
        if (normalUid && !findUsable(normalUid)) setNormalUid(0);
        if (welcomeUid && !findUsable(welcomeUid)) setWelcomeUid(0);
        if (singleUid && !findUsable(singleUid)) setSingleUid(0);
    }, [loaded, coupons, normalUid, welcomeUid, singleUid, findUsable]);

    const selected = useMemo(() => {
        const picked = stackAllowed
            ? [findUsable(normalUid), findUsable(welcomeUid)]
            : [findUsable(singleUid)];
        return picked.filter(Boolean) as AvailableCoupon[];
    }, [stackAllowed, normalUid, welcomeUid, singleUid, findUsable]);

    const discountTotal = useMemo(
        () => Math.min(subtotal, selected.reduce((sum, c) => sum + c.discount, 0)),
        [selected, subtotal]
    );

    const selectedKey = selected.map((c) => c.couponUid).join(",");
    useEffect(() => {
        onChange(
            selected.map((c) => c.couponUid),
            discountTotal
        );
        // selectedKey 로 실제 선택 변화만 반영(부모 콜백 신원 변화로 인한 루프 방지)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedKey, discountTotal]);

    if (!loaded || (coupons.length === 0 && !error)) return null;

    return (
        <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="text-[16px] font-extrabold text-slate-900">쿠폰</div>
                {discountTotal > 0 && (
                    <div className="text-[14px] font-bold text-rose-500">
                        -{discountTotal.toLocaleString()}원
                    </div>
                )}
            </div>

            {error ? (
                <p className="mt-3 text-[13px] text-slate-500">{error}</p>
            ) : stackAllowed ? (
                <div className="mt-3 space-y-3">
                    <CouponSelect
                        label="장바구니 쿠폰"
                        list={normalCoupons}
                        value={normalUid}
                        onChange={setNormalUid}
                    />
                    {welcomeCoupons.length > 0 && (
                        <CouponSelect
                            label="웰컴머니"
                            list={welcomeCoupons}
                            value={welcomeUid}
                            onChange={setWelcomeUid}
                        />
                    )}
                </div>
            ) : (
                <div className="mt-3">
                    <CouponSelect
                        label="쿠폰 (1장만 사용 가능)"
                        list={coupons}
                        value={singleUid}
                        onChange={setSingleUid}
                    />
                </div>
            )}
        </section>
    );
}

function CouponSelect({
    label,
    list,
    value,
    onChange,
}: {
    label: string;
    list: AvailableCoupon[];
    value: number;
    onChange: (uid: number) => void;
}) {
    if (list.length === 0) return null;

    return (
        <label className="block">
            <span className="text-[13px] font-bold text-slate-600">{label}</span>
            <select
                value={String(value)}
                onChange={(e) => onChange(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-800"
            >
                <option value="0">사용 안 함</option>
                {list.map((c) => (
                    <option key={c.couponUid} value={String(c.couponUid)} disabled={!c.usable}>
                        {labelOf(c)}
                    </option>
                ))}
            </select>
        </label>
    );
}
