// src/components/admin/AdminTopbarClient.tsx
"use client";

import { useRouter } from "next/navigation";
import { adminLogout } from "@/lib/admin/adminAuthClient";

export default function AdminTopbarClient() {
    const router = useRouter();

    const onLogout = async () => {
        try {
            await adminLogout();
        } finally {
            router.replace("/admin/login");
            router.refresh();
        }
    };

    return (
        <div className="flex items-center gap-2">
            <a
                href="/admin/dashboard"
                className="rounded-full border border-[var(--dad-border)] bg-white/70 px-4 py-2 text-sm font-bold text-[var(--dad-ink)]"
            >
                Dashboard
            </a>
            <a
                href="/admin/products"
                className="rounded-full border border-[var(--dad-border)] bg-white/70 px-4 py-2 text-sm font-bold text-[var(--dad-ink)]"
            >
                Products
            </a>
            <a
                href="/admin/orders"
                className="rounded-full border border-[var(--dad-border)] bg-white/70 px-4 py-2 text-sm font-bold text-[var(--dad-ink)]"
            >
                Orders
            </a>
            <a
                href="/admin/points"
                className="rounded-full border border-[var(--dad-border)] bg-white/70 px-4 py-2 text-sm font-bold text-[var(--dad-ink)]"
            >
                Points
            </a>

            <button
                onClick={onLogout}
                className="rounded-full bg-[var(--dad-orange)] px-4 py-2 text-sm font-extrabold text-white shadow-sm"
            >
                로그아웃
            </button>
        </div>
    );
}