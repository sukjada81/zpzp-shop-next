// src/components/home/HomeCategoryIcons.tsx
"use client";

import Link from "next/link";

type IconItem = {
    key: string;
    label: string;
    emoji: string;
    href: string;
};

export default function HomeCategoryIcons({ tenant }: { tenant: string }) {
    const items: IconItem[] = [
        { key: "water", label: "정수기", emoji: "🚰", href: `/${tenant}/goods?cat=water` },
        { key: "internet", label: "인터넷", emoji: "📶", href: `/${tenant}/goods?cat=internet` },
        { key: "flower", label: "졸업축하", emoji: "💐", href: `/${tenant}/goods?cat=flower` },
        { key: "wreath", label: "화환", emoji: "🟢", href: `/${tenant}/goods?cat=wreath` },
        { key: "move", label: "이사", emoji: "🚚", href: `/${tenant}/goods?cat=move` },
        { key: "phone", label: "핸드폰", emoji: "📱", href: `/${tenant}/goods?cat=phone` },
        { key: "travel", label: "여행", emoji: "🧳", href: `/${tenant}/goods?cat=travel` },
    ];

    return (
        <div className="mt-3">
            <div className="grid grid-cols-7 gap-2">
                {items.map((it) => (
                    <Link key={it.key} href={it.href} className="flex flex-col items-center">
                        <div
                            className="flex h-12 w-12 items-center justify-center rounded-full"
                            style={{
                                background: "var(--accent-soft)",
                                border: "1px solid var(--border)",
                            }}
                        >
                            <span className="text-lg">{it.emoji}</span>
                        </div>
                        <div className="mt-1 text-[11px] font-semibold text-[color:var(--muted)]">
                            {it.label}
                        </div>
                    </Link>
                ))}
            </div>

            <div className="mt-2 text-center text-xs text-[color:var(--muted)]">
                공구 클릭시 상세내용 확인 가능합니다.
            </div>
        </div>
    );
}