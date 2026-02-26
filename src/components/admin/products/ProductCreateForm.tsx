"use client";

import { useMemo, useState } from "react";
import type { AdminTenant } from "@/lib/admin/types";

type OptionDraft = {
    name: string;
    sku?: string;
    price: number;
    stockQty?: number | null;
    isActive?: boolean;
    sortOrder?: number;
};

export default function ProductCreateForm({ tenants }: { tenants: AdminTenant[] }) {
    const tenantOptions = useMemo(() => tenants ?? [], [tenants]);

    const [tenantSlug, setTenantSlug] = useState(tenantOptions[0]?.slug ?? "");
    const [title, setTitle] = useState("");
    const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
    const [basePrice, setBasePrice] = useState<number>(0);
    const [pickupOnly, setPickupOnly] = useState(true);
    const [minQty, setMinQty] = useState<string>("");
    const [maxQty, setMaxQty] = useState<string>("");
    const [thumbnailUrl, setThumbnailUrl] = useState("");
    const [description, setDescription] = useState("");

    const [options, setOptions] = useState<OptionDraft[]>([
        { name: "기본", price: 0, stockQty: null, isActive: true, sortOrder: 0 },
    ]);

    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [okMsg, setOkMsg] = useState<string | null>(null);

    const addOption = () => {
        setOptions((prev) => [...prev, { name: "", price: 0, stockQty: null, isActive: true }]);
    };

    const removeOption = (idx: number) => {
        setOptions((prev) => prev.filter((_, i) => i !== idx));
    };

    const updateOption = (idx: number, patch: Partial<OptionDraft>) => {
        setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
    };

    const submit = async () => {
        setErr(null);
        setOkMsg(null);

        if (!tenantSlug) return setErr("지점을 선택해주세요.");
        if (!title.trim()) return setErr("상품명을 입력해주세요.");

        setSaving(true);
        try {
            const payload = {
                tenantSlug,
                title: title.trim(),
                description: description || null,
                status,
                thumbnailUrl: thumbnailUrl || null,
                imagesJson: null,
                basePrice,
                pickupOnly,
                minQty: minQty === "" ? null : Number(minQty),
                maxQty: maxQty === "" ? null : Number(maxQty),
                saleStartAt: null,
                saleEndAt: null,
                options: options
                    .map((o, idx) => ({
                        name: String(o.name ?? "").trim(),
                        sku: o.sku ? String(o.sku).trim() : null,
                        price: Number(o.price ?? 0),
                        stockQty: o.stockQty == null || o.stockQty === ("" as any) ? null : Number(o.stockQty),
                        isActive: o.isActive ?? true,
                        sortOrder: o.sortOrder ?? idx,
                    }))
                    .filter((o) => o.name.length > 0),
            };

            const res = await fetch("/api/admin/products", {
                method: "POST",
                headers: { "content-type": "application/json", accept: "application/json" },
                body: JSON.stringify(payload),
                cache: "no-store",
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.ok) {
                throw new Error(data?.message || `HTTP ${res.status}`);
            }

            setOkMsg(`등록 완료 (id=${data.product?.id ?? "?"})`);
            setTitle("");
            setDescription("");
            setBasePrice(0);
            setThumbnailUrl("");
        } catch (e: any) {
            setErr(String(e?.message ?? e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 기본 정보 */}
            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">지점</div>
                    <select
                        className="h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)]"
                        value={tenantSlug}
                        onChange={(e) => setTenantSlug(e.target.value)}
                    >
                        {tenantOptions.map((t) => (
                            <option key={t.slug} value={t.slug}>
                                {t.name} ({t.slug})
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">상태</div>
                    <select
                        className="h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)]"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                    >
                        <option value="draft">draft</option>
                        <option value="active">active</option>
                        <option value="archived">archived</option>
                    </select>
                </label>

                <label className="block md:col-span-2">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">상품명</div>
                    <input
                        className="h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="예) 대용량 종이컵 1000개"
                    />
                </label>

                <label className="block">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">기본가격</div>
                    <input
                        type="number"
                        className="h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                        value={basePrice}
                        onChange={(e) => setBasePrice(Number(e.target.value))}
                    />
                </label>

                <label className="block">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">픽업 전용</div>
                    <div className="flex h-11 items-center gap-2 rounded-2xl border border-[var(--dad-border)] bg-white px-3">
                        <input
                            type="checkbox"
                            checked={pickupOnly}
                            onChange={(e) => setPickupOnly(e.target.checked)}
                        />
                        <span className="text-sm font-bold text-[var(--dad-ink)]">pickup_only</span>
                    </div>
                </label>

                <label className="block">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">최소 수량</div>
                    <input
                        type="number"
                        className="h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                        value={minQty}
                        onChange={(e) => setMinQty(e.target.value)}
                        placeholder="예) 1"
                    />
                </label>

                <label className="block">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">최대 수량</div>
                    <input
                        type="number"
                        className="h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                        value={maxQty}
                        onChange={(e) => setMaxQty(e.target.value)}
                        placeholder="예) 10"
                    />
                </label>

                <label className="block md:col-span-2">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">썸네일 URL</div>
                    <input
                        className="h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                        value={thumbnailUrl}
                        onChange={(e) => setThumbnailUrl(e.target.value)}
                        placeholder="https://..."
                    />
                </label>

                <label className="block md:col-span-2">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">설명</div>
                    <textarea
                        className="min-h-[120px] w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 py-3 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="상품 설명"
                    />
                </label>
            </section>

            {/* 옵션 */}
            <section className="dad-card p-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-extrabold text-[var(--dad-ink)]">옵션</div>
                    <button type="button" onClick={addOption} className="dad-btn dad-btn-ghost h-9 px-3 text-sm">
                        + 옵션 추가
                    </button>
                </div>

                <div className="mt-3 space-y-2">
                    {options.map((o, idx) => (
                        <div
                            key={idx}
                            className="grid grid-cols-1 gap-2 rounded-2xl border border-[var(--dad-border)] bg-white p-3 md:grid-cols-[1.2fr_1fr_1fr_120px_90px]"
                        >
                            <input
                                className="h-10 rounded-xl border border-[var(--dad-border)] px-3 text-sm font-bold"
                                value={o.name}
                                onChange={(e) => updateOption(idx, { name: e.target.value })}
                                placeholder="옵션명"
                            />
                            <input
                                className="h-10 rounded-xl border border-[var(--dad-border)] px-3 text-sm font-bold"
                                value={o.sku ?? ""}
                                onChange={(e) => updateOption(idx, { sku: e.target.value })}
                                placeholder="SKU(선택)"
                            />
                            <input
                                type="number"
                                className="h-10 rounded-xl border border-[var(--dad-border)] px-3 text-sm font-bold"
                                value={o.price}
                                onChange={(e) => updateOption(idx, { price: Number(e.target.value) })}
                                placeholder="가격"
                            />
                            <input
                                type="number"
                                className="h-10 rounded-xl border border-[var(--dad-border)] px-3 text-sm font-bold"
                                value={o.stockQty ?? ""}
                                onChange={(e) =>
                                    updateOption(idx, { stockQty: e.target.value === "" ? null : Number(e.target.value) })
                                }
                                placeholder="재고"
                            />
                            <div className="flex items-center justify-between gap-2">
                                <label className="flex items-center gap-2 text-xs font-extrabold text-[var(--dad-muted)]">
                                    <input
                                        type="checkbox"
                                        checked={o.isActive ?? true}
                                        onChange={(e) => updateOption(idx, { isActive: e.target.checked })}
                                    />
                                    사용
                                </label>
                                {options.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeOption(idx)}
                                        className="dad-btn dad-btn-ghost h-9 px-3 text-xs"
                                    >
                                        삭제
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {err && (
                <div className="rounded-2xl border border-[var(--dad-border)] bg-white/70 p-3 text-sm">
                    <div className="font-extrabold text-[var(--dad-ink)]">에러</div>
                    <div className="mt-1 text-[var(--dad-muted)]">{err}</div>
                </div>
            )}

            {okMsg && (
                <div className="rounded-2xl border border-[var(--dad-border)] bg-white/70 p-3 text-sm">
                    <div className="font-extrabold text-[var(--dad-ink)]">완료</div>
                    <div className="mt-1 text-[var(--dad-muted)]">{okMsg}</div>
                </div>
            )}

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={submit}
                    disabled={saving}
                    className="dad-btn dad-btn-primary h-11 px-5 text-sm disabled:opacity-60"
                >
                    {saving ? "저장 중..." : "저장"}
                </button>
                <a href="/admin/products" className="dad-btn dad-btn-ghost h-11 px-5 text-sm">
                    취소
                </a>
            </div>
        </div>
    );
}