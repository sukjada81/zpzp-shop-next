// src/app/(admin)/admin/layout.tsx
import type { ReactNode } from "react";
import { headers } from "next/headers";
import AdminShell from "@/components/admin/AdminShell";
import { readAdminLinkerFromCookie } from "@/lib/admin/linkerScope";

export default async function AdminLayout({ children }: { children: ReactNode }) {
    const h = await headers();
    const initialLinker = readAdminLinkerFromCookie(h.get("cookie"));

    return <AdminShell initialLinker={initialLinker}>{children}</AdminShell>;
}
