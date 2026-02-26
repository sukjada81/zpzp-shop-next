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
        <div className="space-y-3">
            <label className="block">
                <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">지점</div>
                <select
                    className="h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)]"
                    value={tenant}
                    onChange={(e) => setTenant(e.target.value)}
                >
                    {tenantOptions.map((t: any) => (
                        <option key={t.slug} value={t.slug}>
                            {t.name} ({t.slug})
                        </option>
                    ))}
                </select>
            </label>

            <label className="block">
                <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">상태</div>
                <select
                    className="h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)]"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                >
                    <option value="">전체</option>
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="archived">archived</option>
                </select>
            </label>

            <label className="block">
                <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">검색</div>
                <input
                    className="h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="상품명/설명 검색"
                />
            </label>

            <div className="flex gap-2 pt-1">
                <button onClick={apply} className="dad-btn dad-btn-primary h-10 flex-1 text-sm">
                    적용
                </button>
                <button onClick={reset} className="dad-btn dad-btn-ghost h-10 px-4 text-sm">
                    초기화
                </button>
            </div>
        </div>
    );
}