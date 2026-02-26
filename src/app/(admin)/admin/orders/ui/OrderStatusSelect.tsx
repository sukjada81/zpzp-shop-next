// src/app/(admin)/admin/orders/ui/OrderStatusSelect.tsx
"use client";

import { useState } from "react";

const OPTIONS = ["PENDING", "CONFIRMED", "READY", "DONE", "CANCELED"];

export default function OrderStatusSelect({
                                              id,
                                              current,
                                          }: {
    id: string;
    current: string;
}) {
    const [value, setValue] = useState(current);
    const [saving, setSaving] = useState(false);

    async function save(next: string) {
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ status: next }),
            });
            const data = await res.json().catch(() => ({ ok: false }));
            if (!res.ok || !data.ok) throw new Error(data?.message || "failed");
            setValue(next);
        } catch {
            alert("상태 변경 실패");
            setValue(current);
        } finally {
            setSaving(false);
        }
    }

    return (
        <select
            disabled={saving}
            value={value}
            onChange={(e) => {
                const next = e.target.value;
                setValue(next);
                void save(next);
            }}
            className="h-10 rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-xs font-extrabold text-[var(--dad-ink)]"
        >
            {OPTIONS.map((s) => (
                <option key={s} value={s}>
                    {s}
                </option>
            ))}
        </select>
    );
}