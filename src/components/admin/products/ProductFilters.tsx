"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { AdminTenant } from "@/lib/admin/types";

export default function ProductFilters({ tenants }: { tenants: AdminTenant[] }) {
    const router = useRouter();
    const sp = useSearchParams();

    const initTenant = sp.get("tenant") || "all";
    const initStatus = sp.get("status") || "";
    const initQ = sp.get("q") || "";

    const [tenant, setTenant] = useState(initTenant);
    const [status, setStatus] = useState(initStatus);
    const [q, setQ] = useState(initQ);

    const tenantOptions = useMemo(
        () => [{ slug: "all", name: "전체 지점" } as any, ...(tenants ?? [])],
        [tenants]
    );

    const apply = () => {
        const url = new URL(window.location.href);
        url.searchParams.set("tenant", tenant);
        status ? url.searchParams.set("status", status) : url.searchParams.delete("status");
        q ? url.searchParams.set("q", q) : url.searchParams.delete("q");
        url.searchParams.set("page", "1");
        router.push(url.pathname + "?" + url.searchParams.toString());
        router.refresh();
    };

    const reset = () => {
        router.push("/admin/products");
        router.refresh();
    };

    return (
        <div className="flex flex-wrap items-end gap-3">

            {/* 검색 */}
            <div className="flex flex-col">
                <div className="text-xs font-extrabold text-[var(--dad-muted)]">검색</div>
                <input
                    className="h-11 w-[240px] rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="상품명 검색"
                />
            </div>

            {/* 지점 */}
            <div className="flex flex-col">
                <div className="text-xs font-extrabold text-[var(--dad-muted)]">지점</div>
                <select
                    className="h-11 w-[180px] rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold"
                    value={tenant}
                    onChange={(e) => setTenant(e.target.value)}
                >
                    {tenantOptions.map((t: any) => (
                        <option key={t.slug} value={t.slug}>
                            {t.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* 상태 */}
            <div className="flex flex-col">
                <div className="text-xs font-extrabold text-[var(--dad-muted)]">상태</div>
                <select
                    className="h-11 w-[160px] rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                >
                    <option value="">전체</option>
                    <option value="draft">임시저장</option>
                    <option value="active">판매중</option>
                    <option value="archived">보관</option>
                </select>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 pb-[2px]">
                <button onClick={apply} className="dad-btn dad-btn-primary h-11 px-4 text-sm">
                    검색
                </button>
                <button onClick={reset} className="dad-btn dad-btn-ghost h-11 px-4 text-sm">
                    초기화
                </button>
            </div>

        </div>
    );
}