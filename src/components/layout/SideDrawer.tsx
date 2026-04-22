// src/components/layout/SideDrawer.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
    Home,
    Receipt,
    ShoppingCart,
    Coins,
    Settings,
    Store,
    Flame,
    X,
} from "lucide-react";
import { useCart } from "@/lib/cart/CartProvider";

type DrawerItemDef = {
    href: string;
    label: string;
    Icon: ComponentType<{ className?: string }>;
    disabled?: boolean;
    badgeCount?: number;
};

type AuthSession = {
    ok: boolean;
    loggedIn: boolean;
    tenant?: string;
    member?: { id: string; provider: string } | null;
    user?: { id: string; provider: string } | null;
};

const BRAND_NAME = "디스카운트 올데이";
const HIDE_POINTS_MENU = false;
const HIDE_SELECT_TENANT_MENU = true;
const HIDE_AUTH_BUTTON = false;

function resolveAuthOrigin() {
    if (typeof window === "undefined") {
        return process.env.NEXT_PUBLIC_AUTH_ORIGIN || "https://auth.discountallday.kr";
    }

    const envOrigin = process.env.NEXT_PUBLIC_AUTH_ORIGIN;
    if (envOrigin) return envOrigin;

    const { protocol, host } = window.location;
    const hostWithoutPort = host.split(":")[0];
    const port = host.includes(":") ? `:${host.split(":")[1]}` : "";

    if (hostWithoutPort === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostWithoutPort)) {
        return `${protocol}//localhost${port}`;
    }

    if (hostWithoutPort.endsWith(".discountallday.kr")) {
        return `${protocol}//auth.discountallday.kr${port}`;
    }

    return `${protocol}//auth.discountallday.kr${port}`;
}

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
    const { items } = useCart();

    const cartCount = useMemo(
        () => items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
        [items]
    );

    useEffect(() => {
        let cancelled = false;

        async function run() {
            try {
                const res = await fetch("/auth/session", { cache: "no-store" });
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

    const itemsMenu: DrawerItemDef[] = useMemo(() => {
        const base: DrawerItemDef[] = [
            { href: `/${tenant}/home`, label: "홈", Icon: Home },
            { href: `/${tenant}/groupbuys`, label: "진행 중인 공구", Icon: Flame },
            { href: `/${tenant}/orders`, label: "주문내역", Icon: Receipt },
            {
                href: `/${tenant}/cart`,
                label: "장바구니",
                Icon: ShoppingCart,
                disabled: false,
                badgeCount: cartCount,
            },
            { href: `/${tenant}/settings`, label: "내 정보 설정", Icon: Settings, disabled: false },
        ];

        if (!HIDE_POINTS_MENU) {
            base.splice(3, 0, {
                href: `/${tenant}/points`,
                label: "내 포인트",
                Icon: Coins,
                disabled: false,
            });
        }

        if (!HIDE_SELECT_TENANT_MENU) {
            base.push({
                href: `/select-tenant`,
                label: "지점 변경",
                Icon: Store,
                disabled: false,
            });
        }

        return base;
    }, [tenant, cartCount]);

    function goLogin() {
        onCloseAction();

        const authOrigin = resolveAuthOrigin();
        const returnTo =
            typeof window !== "undefined"
                ? window.location.href
                : `http://${tenant}.discountallday.kr:3000/home`;

        const url = new URL("/login", authOrigin);
        if (tenant) url.searchParams.set("tenant", tenant);
        url.searchParams.set("returnTo", returnTo);
        url.searchParams.set("auto", "0");

        window.location.href = url.toString();
    }

    function doLogout() {
        onCloseAction();

        const authOrigin = resolveAuthOrigin();
        const url = new URL("/auth/logout", authOrigin);

        if (tenant && tenant !== "undefined") {
            url.searchParams.set("tenant", tenant);
        }

        window.location.href = url.toString();
    }

    const cleanStoreName = (brandLabel || "").trim();
    const storeName = cleanStoreName || "가맹점";
    const headerSubText = subLabel?.trim() ? subLabel : "";

    return (
        <>
            <div
                className={[
                    "fixed inset-0 z-40 transition-all",
                    open
                        ? "pointer-events-auto bg-black/40 opacity-100"
                        : "pointer-events-none bg-black/0 opacity-0",
                ].join(" ")}
                onClick={onCloseAction}
            />

            <aside
                className={[
                    "fixed left-0 top-0 z-50 flex h-full w-[86%] max-w-[340px] flex-col bg-white shadow-2xl transition-transform duration-300",
                    open ? "translate-x-0" : "-translate-x-full",
                ].join(" ")}
                role="dialog"
                aria-modal="true"
            >
                <div className="border-b border-[color:var(--border)] px-5 pb-4 pt-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
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
                                        >
                                            {storeName}
                                        </span>
                                    </div>

                                    {headerSubText ? (
                                        <div className="mt-2 text-[11px] text-[color:var(--muted)]">
                                            {headerSubText}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onCloseAction}
                            aria-label="닫기"
                            className="grid h-10 w-10 place-items-center rounded-xl border border-[color:var(--border)] bg-white hover:bg-[color:var(--accent-soft)] active:scale-[0.98]"
                        >
                            <X className="h-5 w-5 text-[color:var(--brand)]" />
                        </button>
                    </div>
                </div>

                <nav className="flex-1 overflow-auto px-3 py-3">
                    <div className="space-y-1">
                        {itemsMenu.map((it, idx) => {
                            const active =
                                pathname === it.href || (pathname?.startsWith(it.href + "/") ?? false);
                            const needDivider = idx === 2;

                            return (
                                <div key={it.href}>
                                    <DrawerItem
                                        href={it.href}
                                        label={it.label}
                                        Icon={it.Icon}
                                        active={active}
                                        disabled={!!it.disabled}
                                        badgeCount={it.badgeCount}
                                        onClickAction={onCloseAction}
                                    />
                                    {needDivider ? (
                                        <div className="my-2 h-px bg-[color:var(--border)]" />
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-6 px-2 text-[11px] text-[color:var(--muted)]">v1.0</div>
                </nav>

                {!HIDE_AUTH_BUTTON ? (
                    <div className="border-t border-[color:var(--border)] p-4">
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
                                카카오 로그인
                            </button>
                        )}
                    </div>
                ) : null}
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
                        badgeCount,
                        onClickAction,
                    }: {
    href: string;
    label: string;
    Icon: ComponentType<{ className?: string }>;
    active?: boolean;
    disabled?: boolean;
    badgeCount?: number;
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
                <span className="rounded-full bg-[color:var(--accent-soft)] px-2 py-0.5 text-[11px] text-[color:var(--brand)]">
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

            {badgeCount && badgeCount > 0 ? (
                <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-extrabold leading-none text-white">
                    {badgeCount > 99 ? "99+" : badgeCount}
                </span>
            ) : null}
        </Link>
    );
}