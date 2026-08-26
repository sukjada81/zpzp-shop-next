// src/components/admin/AdminLinkerScopeSelect.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_LINKER_COOKIE, normalizeLinkerScopeValue } from "@/lib/admin/linkerScope";

type LinkerOption = {
    uid: number;
    shopSlug: string;
    shopName: string;
    status?: string;
};

function readCookieLinker() {
    if (typeof document === "undefined") return "all";
    const match = document.cookie.match(/(?:^|;\s*)admin_linker_scope=([^;]*)/);
    if (!match) return "all";
    try {
        return normalizeLinkerScopeValue(decodeURIComponent(match[1]));
    } catch {
        return normalizeLinkerScopeValue(match[1]);
    }
}

export default function AdminLinkerScopeSelect({
    initialLinker = "all",
}: {
    initialLinker?: string;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [pending, startTransition] = useTransition();
    const [linker, setLinker] = useState(normalizeLinkerScopeValue(initialLinker));
    const [options, setOptions] = useState<LinkerOption[]>([]);
    const [loading, setLoading] = useState(true);

    // 링커 승인 페이지는 범위 필터 대상 아님 — 셀렉트는 보이되 데이터 영향 없음(쿠키만 유지)
    const scopeAffectsPage =
        pathname.startsWith("/admin/dashboard") ||
        pathname.startsWith("/admin/orders") ||
        pathname.startsWith("/admin/products");

    useEffect(() => {
        setLinker(readCookieLinker() || normalizeLinkerScopeValue(initialLinker));
    }, [initialLinker]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/admin/linker-products/linkers?page=1&limit=200", {
                    cache: "no-store",
                });
                const json = await res.json().catch(() => null);
                if (cancelled) return;
                const items = Array.isArray(json?.items) ? json.items : [];
                setOptions(
                    items.map((row: any) => ({
                        uid: Number(row.uid),
                        shopSlug: String(row.shopSlug ?? ""),
                        shopName: String(row.shopName ?? row.shopSlug ?? ""),
                        status: String(row.status ?? ""),
                    }))
                );
            } catch {
                if (!cancelled) setOptions([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    async function onChange(next: string) {
        const value = normalizeLinkerScopeValue(next);
        setLinker(value);
        document.cookie = `${ADMIN_LINKER_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax`;
        await fetch("/api/admin/scope", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ linker: value }),
        }).catch(() => null);

        startTransition(() => {
            if (scopeAffectsPage) {
                router.refresh();
            }
        });
    }

    const selected = options.find((row) => String(row.uid) === linker);
    const label =
        linker === "all"
            ? "전체 링커"
            : selected?.shopName || selected?.shopSlug || `링커 #${linker}`;

    return (
        <div className="w-full">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="text-xs font-semibold text-[var(--dad-muted)]">관리 범위</div>
                    <div className="mt-1 truncate text-sm font-extrabold text-[var(--dad-ink)]">{label}</div>
                </div>
                <span className="dad-chip shrink-0">{linker === "all" ? "ALL" : `#${linker}`}</span>
            </div>

            <label className="mt-3 block">
                <span className="sr-only">링커 선택</span>
                <select
                    value={linker}
                    disabled={loading || pending}
                    onChange={(e) => void onChange(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)] disabled:opacity-60"
                >
                    <option value="all">전체 링커</option>
                    {options.map((row) => (
                        <option key={row.uid} value={String(row.uid)}>
                            {row.shopName || row.shopSlug} ({row.shopSlug})
                        </option>
                    ))}
                </select>
            </label>

            {!scopeAffectsPage ? (
                <div className="mt-2 text-[11px] font-semibold text-[var(--dad-muted)]">
                    이 메뉴(링커 승인)는 범위 필터와 무관합니다.
                </div>
            ) : null}
        </div>
    );
}
