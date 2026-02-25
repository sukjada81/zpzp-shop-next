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
                href="/admin/tenants"
                className="rounded-full border border-[var(--dad-border)] bg-white/70 px-4 py-2 text-sm font-bold text-[var(--dad-ink)]"
            >
                Tenants
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