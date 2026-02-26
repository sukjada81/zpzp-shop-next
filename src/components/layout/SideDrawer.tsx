// src/components/layout/SideDrawer.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";

type DrawerItemDef = {
    href: string;
    label: string;
    Icon: ComponentType<{ className?: string }>;
    disabled?: boolean;
};

type AuthSession = {
    ok: boolean;
    loggedIn: boolean;
    tenant?: string;
    user?: { id: string; provider: string } | null;
};

const BRAND_NAME = "디스카운트 올데이";

export default function SideDrawer({
                                       open,
                                       onCloseAction,
                                       tenant,
                                       brandLabel = "",
                                       subLabel = "",
                                   }: {
    open: boolean;
    onCloseAction: () => void;
    tenant: string;
    brandLabel?: string;
    subLabel?: string;
}) {
    const pathname = usePathname();
    const [session, setSession] = useState<AuthSession | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            try {
                const res = await fetch("/api/auth/session", { cache: "no-store" });
                const data = (await res.json()) as AuthSession;
                if (cancelled) return;
                setSession(data);
            } catch {
                if (!cancelled) setSession({ ok: true, loggedIn: false });
            }
        }

        if (open) run();

        return () => {
            cancelled = true;
        };
    }, [open]);

    const isLoggedIn = !!session?.loggedIn;

    const items: DrawerItemDef[] = useMemo(
        () => [
            { href: `/${tenant}/home`, label: "홈", Icon: IconToday },
            { href: `/${tenant}/orders`, label: "주문내역", Icon: IconReceipt },
            { href: `/${tenant}/points`, label: "내 포인트", Icon: IconCoin, disabled: false },
            { href: `/${tenant}/settings`, label: "설정", Icon: IconSettings, disabled: false },
            { href: `/select-tenant`, label: "지점 변경", Icon: IconStore, disabled: false },
        ],
        [tenant]
    );

    function goLogin() {
        onCloseAction();
        window.location.href = `/${tenant}/login`;
    }

    function doLogout() {
        onCloseAction();
        const t = tenant && tenant !== "undefined" ? tenant : "";
        window.location.href = `/api/auth/logout?tenant=${encodeURIComponent(t)}`;
    }

    // ✅ "현재 지점 · a · A 지점" -> "A 지점"만 표시
    const cleanStoreName = (brandLabel || "").trim();
    const storeName = cleanStoreName || "가맹점";

    // (옵션) subtitle은 작은 안내 텍스트로만 유지
    const headerSubText = subLabel?.trim() ? subLabel : "";

    return (
        <>
            {/* overlay */}
            <div
                className={[
                    "fixed inset-0 z-40 transition-all",
                    open ? "opacity-100" : "pointer-events-none opacity-0",
                    "bg-black/35 backdrop-blur-[2px]",
                ].join(" ")}
                onClick={onCloseAction}
                aria-hidden="true"
            />

            {/* drawer */}
            <aside
                className={[
                    "fixed left-0 top-0 z-50 h-dvh w-[300px]",
                    "bg-[color:var(--surface)] text-[color:var(--fg)] shadow-2xl",
                    "transition-transform duration-200 ease-out",
                    open ? "translate-x-0" : "-translate-x-full",
                    "flex flex-col",
                ].join(" ")}
                role="dialog"
                aria-modal="true"
            >
                {/* header */}
                <div className="px-5 pt-5 pb-4 border-b border-[color:var(--border)]">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            {/* ✅ 로고 + 브랜드 문구 + 지점 뱃지(NAME만) */}
                            <div className="flex items-center gap-3">
                                <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-[color:var(--border)] bg-white">
                                    <Image
                                        src="/logo_side.png"
                                        alt={BRAND_NAME}
                                        fill
                                        sizes="40px"
                                        className="object-contain p-1"
                                        priority
                                    />
                                </div>

                                <div className="min-w-0">
                                    <div className="text-[14px] font-extrabold tracking-tight text-[color:var(--brand)]">
                                        {BRAND_NAME}
                                    </div>

                                    <div className="mt-1 flex items-center gap-2">
                    <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-extrabold"
                        style={{
                            background: "var(--brand-soft)",
                            color: "var(--brand)",
                            border: "1px solid var(--border)",
                        }}
                        // title={storeName}
                    >
                      {storeName}
                    </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onCloseAction}
                            aria-label="닫기"
                            className="grid h-10 w-10 place-items-center rounded-xl border border-[color:var(--border)] bg-white hover:bg-[color:var(--accent-soft)] active:scale-[0.98]"
                        >
                            <IconX className="h-5 w-5 text-[color:var(--brand)]" />
                        </button>
                    </div>
                </div>

                {/* menu */}
                <nav className="px-3 py-3 flex-1 overflow-auto">
                    <div className="space-y-1">
                        {items.map((it, idx) => {
                            const active =
                                pathname === it.href || (pathname?.startsWith(it.href + "/") ?? false);
                            const needDivider = idx === 1 || idx === 3;

                            return (
                                <div key={it.href}>
                                    <DrawerItem
                                        href={it.href}
                                        label={it.label}
                                        Icon={it.Icon}
                                        active={active}
                                        disabled={!!it.disabled}
                                        onClickAction={onCloseAction}
                                    />
                                    {needDivider ? <div className="my-2 h-px bg-[color:var(--border)]" /> : null}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-6 px-2 text-[11px] text-[color:var(--muted)]">v1.0</div>
                </nav>

                {/* bottom action */}
                <div className="p-4 border-t border-[color:var(--border)]">
                    {isLoggedIn ? (
                        <button
                            type="button"
                            onClick={doLogout}
                            className="w-full rounded-2xl py-3 text-[14px] font-extrabold text-white active:scale-[0.99]"
                            style={{ background: "var(--accent)" }}
                        >
                            로그아웃
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={goLogin}
                            className="w-full rounded-2xl py-3 text-[14px] font-extrabold text-[color:var(--fg)] active:scale-[0.99]"
                            style={{ background: "var(--kakao)" }}
                        >
                            카카오로 로그인
                        </button>
                    )}
                </div>
            </aside>
        </>
    );
}

function DrawerItem({
                        href,
                        label,
                        Icon,
                        active,
                        disabled,
                        onClickAction,
                    }: {
    href: string;
    label: string;
    Icon: ComponentType<{ className?: string }>;
    active?: boolean;
    disabled?: boolean;
    onClickAction: () => void;
}) {
    const base =
        "flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-semibold transition-colors";
    const iconWrapBase = "grid h-9 w-9 place-items-center rounded-xl border";

    if (disabled) {
        return (
            <div className={[base, "text-[color:var(--muted)] opacity-60"].join(" ")}>
        <span
            className={[
                iconWrapBase,
                "border-[color:var(--border)] bg-[color:var(--brand-soft)]",
            ].join(" ")}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
                <span className="flex-1">{label}</span>
                <span className="text-[11px] rounded-full bg-[color:var(--accent-soft)] px-2 py-0.5 text-[color:var(--brand)]">
          준비중
        </span>
            </div>
        );
    }

    return (
        <Link
            href={href}
            onClick={onClickAction}
            className={[
                base,
                active
                    ? "bg-[color:var(--brand-soft)] text-[color:var(--brand)]"
                    : "text-[color:var(--fg)] hover:bg-[color:var(--accent-soft)]",
            ].join(" ")}
        >
      <span className={[iconWrapBase, "border-[color:var(--border)] bg-white"].join(" ")}>
        <Icon
            className={[
                "h-[18px] w-[18px]",
                active ? "text-[color:var(--brand)]" : "text-[color:var(--muted)]",
            ].join(" ")}
        />
      </span>
            <span className="flex-1">{label}</span>
            <span className="text-[color:var(--muted)]/50">›</span>
        </Link>
    );
}

/* -------------------------
 * Inline SVG Icons (no deps)
 * ------------------------- */

function Svg({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <svg
            className={className ?? "h-5 w-5"}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

function IconX({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
        </Svg>
    );
}

function IconToday({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6" />
            <path d="M4 12V6a2 2 0 0 1 2-2h3" />
            <path d="M20 12V6a2 2 0 0 0-2-2h-3" />
            <path d="M9 4v4" />
            <path d="M15 4v4" />
            <path d="M7 12h10" />
        </Svg>
    );
}

function IconReceipt({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="M6 2h12v20l-2-1-2 1-2-1-2 1-2-1-2 1V2Z" />
            <path d="M8 7h8" />
            <path d="M8 11h8" />
            <path d="M8 15h6" />
        </Svg>
    );
}

function IconCoin({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <ellipse cx="12" cy="7" rx="7" ry="3" />
            <path d="M5 7v5c0 1.66 3.13 3 7 3s7-1.34 7-3V7" />
            <path d="M5 12v5c0 1.66 3.13 3 7 3s7-1.34 7-3v-5" />
        </Svg>
    );
}

function IconSettings({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
            <path d="M19.4 15a7.9 7.9 0 0 0 .1-2l2-1.5-2-3.5-2.4.7a7.6 7.6 0 0 0-1.7-1l-.4-2.5H11l-.4 2.5c-.6.2-1.2.6-1.7 1L6.5 8 4.5 11.5l2 1.5a7.9 7.9 0 0 0 .1 2l-2 1.5 2 3.5 2.4-.7c.5.4 1.1.7 1.7 1l.4 2.5h4l.4-2.5c.6-.2 1.2-.6 1.7-1l2.4.7 2-3.5-2-1.5Z" />
        </Svg>
    );
}

function IconStore({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="M3 9l1-5h16l1 5" />
            <path d="M5 9v11h14V9" />
            <path d="M9 20v-6h6v6" />
        </Svg>
    );
}