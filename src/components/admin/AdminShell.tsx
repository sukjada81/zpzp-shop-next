// src/components/admin/AdminShell.tsx
"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import AdminTopbar from "./AdminTopbar";
import AdminSidebar from "./AdminSidebar";

export default function AdminShell({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="dad-admin min-h-dvh">
            <AdminTopbar onToggle={() => setOpen((v) => !v)} />

            <div className="mx-auto w-full max-w-[1440px] px-3 pb-10 pt-4 sm:px-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
                    <AdminSidebar open={open} onClose={() => setOpen(false)} />

                    <main className="min-w-0">
                        <div className="dad-card p-4 sm:p-6">{children}</div>
                    </main>
                </div>
            </div>
        </div>
    );
}