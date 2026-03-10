// src/app/(admin)/admin/orders/ui/OrderStatusSelect.tsx
"use client";

import { useEffect, useState } from "react";

const OPTIONS = [
    { value: "0", label: "주문접수" },
    { value: "1", label: "현장결제완료" },
    { value: "2", label: "픽업준비완료" },
    { value: "4", label: "픽업완료" },
    { value: "9", label: "주문취소" },
];

export default function OrderStatusSelect({
                                              orderNum,
                                              current,
                                          }: {
    orderNum: string;
    current: string;
}) {
    const [value, setValue] = useState(String(current ?? "0"));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setValue(String(current ?? "0"));
    }, [current]);

    async function save(next: string) {
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderNum)}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({ status: Number(next) }),
                credentials: "include",
            });

            const data = await res.json().catch(() => ({ ok: false }));

            if (!res.ok || !data?.ok) {
                throw new Error(data?.message || "failed");
            }

            setValue(next);
        } catch {
            alert("상태 변경 실패");
            setValue(String(current ?? "0"));
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
            {OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    );
}