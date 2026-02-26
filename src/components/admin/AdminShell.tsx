// src/components/admin/AdminShell.tsx
"use client";

import AdminTopbar from "./AdminTopbar";
import AdminSidebar from "./AdminSidebar";

export default function AdminShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-dvh bg-[var(--dad-bg)]">
            <AdminTopbar />

            <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-4 px-3 pb-10 pt-4 sm:px-4 lg:grid-cols-[290px_1fr]">
                <AdminSidebar />
                <main className="min-w-0">{children}</main>
            </div>
        </div>
    );
}