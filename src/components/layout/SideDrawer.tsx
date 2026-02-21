// src/components/layout/SideDrawer.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";

type DrawerItemDef = {
    href: string;
    label: string;
    Icon: ComponentType<{ className?: string }>;
    disabled?: boolean;
};

const AUTH_FLAG_KEY = "auth.loggedIn"; // ✅ UI용 더미 (카카오 연동 시 교체)

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
    const router = useRouter();
    const showBrand = !!brandLabel?.trim();

    // ✅ UI 우선: 로그인 상태 더미 (카카오 연동 시 서버 세션/토큰으로 교체)
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        try {
            setIsLoggedIn(localStorage.getItem(AUTH_FLAG_KEY) === "1");
        } catch {
            setIsLoggedIn(false);
        }
    }, []);

    const items: DrawerItemDef[] = useMemo(
        () => [
            { href: `/${tenant}/home`, label: "오늘의 공구", Icon: IconToday },
            { href: `/${tenant}/orders`, label: "주문내역", Icon: IconReceipt },
            { href: `/${tenant}/points`, label: "내 포인트", Icon: IconCoin, disabled: true },
            { href: `/${tenant}/settings`, label: "설정", Icon: IconSettings, disabled: true },
        ],
        [tenant],
    );

    function goLogin() {
        onCloseAction();
        router.push(`/${tenant}/login`);
    }

    function doLogout() {
        try {
            localStorage.setItem(AUTH_FLAG_KEY, "0");
        } catch {}
        setIsLoggedIn(false);
        onCloseAction();
        router.push(`/${tenant}/home`);
    }

    return (
        <>
            {/* ✅ 오버레이: dim + blur */}
            <div
                className={[
                    "fixed inset-0 z-40 transition-all",
                    open ? "opacity-100" : "pointer-events-none opacity-0",
                    "bg-black/35 backdrop-blur-[2px]",
                ].join(" ")}
                onClick={onCloseAction}
                aria-hidden="true"
            />

            {/* ✅ 드로어 */}
            <aside
                className={[
                    "fixed left-0 top-0 z-50 h-dvh w-[300px] bg-white shadow-2xl",
                    "transition-transform duration-200 ease-out",
                    open ? "translate-x-0" : "-translate-x-full",
                ].join(" ")}
                role="dialog"
                aria-modal="true"
            >
                {/* 상단 헤더 */}
                <div className="px-5 pt-5 pb-4 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            {showBrand ? (
                                <div className="inline-flex items-center gap-2">
                  <span
                      className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-extrabold"
                      style={{
                          background: "var(--brand-soft)",
                          color: "var(--brand)",
                          border: "1px solid var(--border)",
                      }}
                  >
                    {brandLabel}
                  </span>
                                </div>
                            ) : (
                                <div className="text-[14px] font-extrabold text-slate-900">메뉴</div>
                            )}

                            {subLabel?.trim() ? (
                                <div className="mt-2 text-[12px] text-slate-500 truncate">{subLabel}</div>
                            ) : null}
                        </div>

                        <button
                            type="button"
                            onClick={onCloseAction}
                            aria-label="닫기"
                            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98]"
                        >
                            <IconX className="h-5 w-5" />
                        </button>
                    </div>

                    {/* ✅ 로그인/로그아웃: 상단 근처(메뉴 위) */}
                    <div className="mt-4">
                        {isLoggedIn ? (
                            <div className="flex items-center gap-2">
                                <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                    <div className="text-[12px] font-extrabold text-slate-900">로그인됨</div>
                                    <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
                                        계정 정보는 카카오 연동 후 표시
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={doLogout}
                                    className="h-[52px] shrink-0 rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-extrabold text-slate-700 hover:bg-slate-50 active:scale-[0.99]"
                                >
                                    로그아웃
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={goLogin}
                                className="w-full rounded-2xl px-4 py-3 text-[14px] font-extrabold text-white active:scale-[0.99]"
                                style={{ background: "var(--brand)" }}
                            >
                                로그인하기
                            </button>
                        )}
                    </div>
                </div>

                {/* 메뉴 리스트 */}
                <nav className="px-3 py-3">
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
                                    {needDivider ? <div className="my-2 h-px bg-slate-100" /> : null}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-6 px-2 text-[11px] text-slate-400">v1.0</div>
                </nav>
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
            <div className={[base, "text-slate-400"].join(" ")}>
        <span className={[iconWrapBase, "border-slate-200 bg-slate-50 text-slate-400"].join(" ")}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
                <span className="flex-1">{label}</span>
                <span className="text-[11px] rounded-full bg-slate-100 px-2 py-0.5">준비중</span>
            </div>
        );
    }

    return (
        <Link
            href={href}
            onClick={onClickAction}
            className={[
                base,
                active ? "bg-slate-50 text-slate-900" : "text-slate-700 hover:bg-slate-50",
            ].join(" ")}
        >
      <span className={[iconWrapBase, "border-slate-200 bg-white"].join(" ")}>
        {/* ✅ style 제거: className만으로 컬러 처리 */}
          <Icon
              className={[
                  "h-[18px] w-[18px]",
                  active ? "text-[color:var(--brand)]" : "text-slate-500",
              ].join(" ")}
          />
      </span>
            <span className="flex-1">{label}</span>
            <span className="text-slate-300">›</span>
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