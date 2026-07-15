// src/app/(admin)/admin/products/new/ui/AdminProductNewClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type TenantRow = { id: string | number; slug: string; name: string; status: string };

type OptionRow = {
    name: string;
    sku?: string;
    price: number;
    stockQty?: number | null;
    isActive: boolean;
    sortOrder: number;
};

export default function AdminProductNewClient() {
    const [tenants, setTenants] = useState<TenantRow[]>([]);
    const [loadingTenants, setLoadingTenants] = useState(true);

    const [tenantSlug, setTenantSlug] = useState("");
    const [title, setTitle] = useState("");
    const [status, setStatus] = useState("draft");
    const [basePrice, setBasePrice] = useState<number>(0);
    const [pickupOnly, setPickupOnly] = useState(false);
    const [minQty, setMinQty] = useState<string>("");
    const [maxQty, setMaxQty] = useState<string>("");

    const [thumbnailUrl, setThumbnailUrl] = useState("");
    const [imagesJson, setImagesJson] = useState<string>('[""]'); // 문자열 JSON으로 저장

    const [saleStartAt, setSaleStartAt] = useState<string>("");
    const [saleEndAt, setSaleEndAt] = useState<string>("");
    const [alwaysOnSale, setAlwaysOnSale] = useState<boolean>(false);

    const [description, setDescription] = useState("");

    const [options, setOptions] = useState<OptionRow[]>([
        { name: "기본", sku: "", price: 0, stockQty: null, isActive: true, sortOrder: 0 },
    ]);

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            setLoadingTenants(true);
            try {
                const res = await fetch("/api/admin/tenants", { cache: "no-store" });
                const data = await res.json().catch(() => ({ ok: false }));
                if (!res.ok || !data.ok) throw new Error(data?.message || "failed");
                setTenants(data.rows || []);
                // 기본값 세팅
                if ((data.rows || []).length > 0) setTenantSlug(data.rows[0].slug);
            } catch (e) {
                alert("지점 목록 조회 실패");
            } finally {
                setLoadingTenants(false);
            }
        })();
    }, []);

    const canSubmit = useMemo(() => {
        return !!tenantSlug && title.trim().length > 0 && !saving;
    }, [tenantSlug, title, saving]);

    function updateOption(i: number, patch: Partial<OptionRow>) {
        setOptions((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    }

    function addOption() {
        setOptions((prev) => [
            ...prev,
            { name: "", sku: "", price: 0, stockQty: null, isActive: true, sortOrder: prev.length },
        ]);
    }

    function removeOption(i: number) {
        setOptions((prev) => prev.filter((_, idx) => idx !== i));
    }

    async function onSubmit() {
        if (!canSubmit) return;

        // imagesJson 검증(문자열 JSON)
        try {
            if (imagesJson.trim()) JSON.parse(imagesJson);
        } catch {
            alert('추가 이미지(JSON) 형식이 올바르지 않습니다. 예: ["url1","url2"]');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                tenantSlug,
                title,
                description,
                status,
                thumbnailUrl: thumbnailUrl || null,
                imagesJson: imagesJson || null,
                basePrice,
                pickupOnly,
                minQty: minQty === "" ? null : Number(minQty),
                maxQty: maxQty === "" ? null : Number(maxQty),
                saleStartAt: alwaysOnSale ? null : (saleStartAt || null),
                saleEndAt: alwaysOnSale ? null : (saleEndAt || null),
                options: options
                    .map((o, idx) => ({ ...o, sortOrder: Number(o.sortOrder ?? idx) }))
                    .filter((o) => o.name.trim().length > 0),
            };

            const res = await fetch("/api/admin/products", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({ ok: false }));

            if (!res.ok || !data.ok) throw new Error(data?.message || "failed");

            alert("상품이 등록되었습니다.");
            // 등록 후 목록 페이지로 이동(다음 단계에서 /admin/products 만들 예정)
            window.location.href = "/dashboard";
        } catch (e: any) {
            alert(`등록 실패: ${e?.message || "unknown error"}`);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="dad-card p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-lg font-extrabold text-[var(--dad-ink)]">상품 등록</div>
                        <div className="text-sm font-bold text-[var(--dad-muted)]">
                            지점을 선택하고 상품/옵션을 등록합니다.
                        </div>
                    </div>
                    <a className="dad-btn dad-btn-ghost px-4 py-2 text-sm" href="/dashboard">
                        대시보드 →
                    </a>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
                    <div className="lg:col-span-3">
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">지점</label>
                        <select
                            disabled={loadingTenants}
                            value={tenantSlug}
                            onChange={(e) => setTenantSlug(e.target.value)}
                            className="mt-1 h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)]"
                        >
                            {tenants.map((t) => (
                                <option key={t.slug} value={t.slug}>
                                    {t.name} ({t.slug})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="lg:col-span-6">
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">상품명</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="mt-1 h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                            placeholder="예: A지점 오늘의 공구 상품"
                        />
                    </div>

                    <div className="lg:col-span-3">
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">상태</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="mt-1 h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)]"
                        >
                            <option value="draft">draft</option>
                            <option value="active">active</option>
                            <option value="hidden">hidden</option>
                            <option value="soldout">soldout</option>
                            <option value="ended">ended</option>
                        </select>
                    </div>

                    <div className="lg:col-span-3">
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">기본가</label>
                        <input
                            type="number"
                            value={basePrice}
                            onChange={(e) => setBasePrice(Number(e.target.value))}
                            className="mt-1 h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)]"
                        />
                    </div>

                    <div className="lg:col-span-3 flex items-end gap-2">
                        <label className="flex items-center gap-2 rounded-2xl border border-[var(--dad-border)] bg-white/70 px-4 py-3 text-sm font-extrabold text-[var(--dad-ink)]">
                            <input
                                type="checkbox"
                                checked={pickupOnly}
                                onChange={(e) => setPickupOnly(e.target.checked)}
                            />
                            픽업 전용
                        </label>
                    </div>

                    <div className="lg:col-span-3">
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">최소수량</label>
                        <input
                            value={minQty}
                            onChange={(e) => setMinQty(e.target.value)}
                            className="mt-1 h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)]"
                            placeholder="예: 1"
                        />
                    </div>

                    <div className="lg:col-span-3">
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">최대수량</label>
                        <input
                            value={maxQty}
                            onChange={(e) => setMaxQty(e.target.value)}
                            className="mt-1 h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)]"
                            placeholder="예: 5"
                        />
                    </div>

                    <div className="lg:col-span-6">
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">썸네일 URL</label>
                        <input
                            value={thumbnailUrl}
                            onChange={(e) => setThumbnailUrl(e.target.value)}
                            className="mt-1 h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)]"
                            placeholder="https://..."
                        />
                    </div>

                    <div className="lg:col-span-6">
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">추가 이미지(JSON 문자열)</label>
                        <input
                            value={imagesJson}
                            onChange={(e) => setImagesJson(e.target.value)}
                            className="mt-1 h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)]"
                            placeholder='예: ["https://.../1.jpg","https://.../2.jpg"]'
                        />
                    </div>

                    <div className="lg:col-span-3 flex items-end gap-2">
                        <label className="flex items-center gap-2 rounded-2xl border border-[var(--dad-border)] bg-white/70 px-4 py-3 text-sm font-extrabold text-[var(--dad-ink)]">
                            <input
                                type="checkbox"
                                checked={alwaysOnSale}
                                onChange={(e) => {
                                    setAlwaysOnSale(e.target.checked);
                                    if (e.target.checked) {
                                        setSaleStartAt("");
                                        setSaleEndAt("");
                                    }
                                }}
                            />
                            항시 판매 (날짜 제한 없음)
                        </label>
                    </div>

                    <div className="lg:col-span-3">
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">판매 시작</label>
                        <input
                            type="datetime-local"
                            value={saleStartAt}
                            onChange={(e) => setSaleStartAt(e.target.value)}
                            disabled={alwaysOnSale}
                            className="mt-1 h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)] disabled:opacity-40"
                        />
                    </div>

                    <div className="lg:col-span-3">
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">판매 종료</label>
                        <input
                            type="datetime-local"
                            value={saleEndAt}
                            onChange={(e) => setSaleEndAt(e.target.value)}
                            disabled={alwaysOnSale}
                            className="mt-1 h-11 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)] disabled:opacity-40"
                        />
                    </div>

                    <div className="lg:col-span-12">
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">설명</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-1 min-h-[140px] w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                            placeholder="상품 설명"
                        />
                    </div>
                </div>
            </div>

            <div className="dad-card p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-extrabold text-[var(--dad-ink)]">옵션</div>
                        <div className="text-xs font-bold text-[var(--dad-muted)]">
                            옵션명/가격/재고를 다건으로 추가합니다.
                        </div>
                    </div>
                    <button className="dad-btn dad-btn-ghost px-4 py-2 text-sm" onClick={addOption} type="button">
                        + 옵션 추가
                    </button>
                </div>

                <div className="mt-3 overflow-x-auto">
                    <table className="min-w-[900px] w-full text-sm">
                        <thead>
                        <tr className="border-b border-[var(--dad-border)] text-xs font-extrabold text-[var(--dad-muted)]">
                            <th className="py-2 pr-2">옵션명</th>
                            <th className="py-2 pr-2">SKU</th>
                            <th className="py-2 pr-2 text-right">가격</th>
                            <th className="py-2 pr-2 text-right">재고</th>
                            <th className="py-2 pr-2">활성</th>
                            <th className="py-2 pr-2 text-right">정렬</th>
                            <th className="py-2 pr-2 text-right">삭제</th>
                        </tr>
                        </thead>
                        <tbody>
                        {options.map((o, i) => (
                            <tr key={i} className="border-b border-[var(--dad-border)]">
                                <td className="py-2 pr-2">
                                    <input
                                        value={o.name}
                                        onChange={(e) => updateOption(i, { name: e.target.value })}
                                        className="h-10 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)]"
                                        placeholder="예: 1개 / 2개"
                                    />
                                </td>
                                <td className="py-2 pr-2">
                                    <input
                                        value={o.sku || ""}
                                        onChange={(e) => updateOption(i, { sku: e.target.value })}
                                        className="h-10 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold text-[var(--dad-ink)]"
                                        placeholder="선택"
                                    />
                                </td>
                                <td className="py-2 pr-2">
                                    <input
                                        type="number"
                                        value={o.price}
                                        onChange={(e) => updateOption(i, { price: Number(e.target.value) })}
                                        className="h-10 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-right text-sm font-bold text-[var(--dad-ink)]"
                                    />
                                </td>
                                <td className="py-2 pr-2">
                                    <input
                                        type="number"
                                        value={o.stockQty ?? ""}
                                        onChange={(e) =>
                                            updateOption(i, { stockQty: e.target.value === "" ? null : Number(e.target.value) })
                                        }
                                        className="h-10 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-right text-sm font-bold text-[var(--dad-ink)]"
                                    />
                                </td>
                                <td className="py-2 pr-2">
                                    <input
                                        type="checkbox"
                                        checked={o.isActive}
                                        onChange={(e) => updateOption(i, { isActive: e.target.checked })}
                                    />
                                </td>
                                <td className="py-2 pr-2">
                                    <input
                                        type="number"
                                        value={o.sortOrder}
                                        onChange={(e) => updateOption(i, { sortOrder: Number(e.target.value) })}
                                        className="h-10 w-[120px] rounded-2xl border border-[var(--dad-border)] bg-white px-3 text-right text-sm font-bold text-[var(--dad-ink)]"
                                    />
                                </td>
                                <td className="py-2 pr-2 text-right">
                                    <button
                                        type="button"
                                        className="dad-btn dad-btn-ghost px-3 py-2 text-xs"
                                        onClick={() => removeOption(i)}
                                        disabled={options.length <= 1}
                                    >
                                        삭제
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        type="button"
                        disabled={!canSubmit}
                        onClick={onSubmit}
                        className={[
                            "rounded-2xl px-6 py-3 text-sm font-extrabold",
                            canSubmit ? "bg-[var(--dad-orange)] text-white" : "bg-slate-200 text-slate-500",
                        ].join(" ")}
                    >
                        {saving ? "등록 중..." : "상품 등록"}
                    </button>
                </div>
            </div>
        </div>
    );
}