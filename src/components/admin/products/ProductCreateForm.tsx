"use client";

import { useMemo, useState } from "react";
import { PRODUCT_STATUS_OPTIONS, statusLabel } from "@/lib/admin/productStatus";

type Tenant = { id: string | number; slug?: string; name?: string };

type Props = {
    tenants: Tenant[];
};

type OptionValueRow = {
    id: string;
    valueName: string;
    addPrice: string;
    stockQty: string;
};

type OptionGroupRow = {
    id: string;
    groupName: string;
    values: OptionValueRow[];
};

type FormState = {
    tenantSlug: string;
    status: string;

    title: string;
    name: string;
    price: number;
    origPrice: number;
    consumerPrice: number;

    pickupOnly: boolean;
    displayUse: boolean;
    saleUse: boolean;

    image1: string;
    image2: string;
    image3: string;

    explains: string;

    optionUse: boolean;

    minQty: string;
    maxQty: string;
};

function safeNum(n: any, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
}

function guessTenantSlug(tenants: Tenant[], fallback = "all") {
    const first = tenants?.[0];
    const slug = (first?.slug || "").toString().trim();
    return slug || fallback;
}

function getAssetOrigin() {
    return (process.env.NEXT_PUBLIC_ASSET_ORIGIN || "https://discountallday.kr").replace(/\/+$/, "");
}

function toPreviewUrl(input: string) {
    const v = (input || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (/^\/\//.test(v)) return `https:${v}`;
    const assetOrigin = getAssetOrigin();
    const path = v.startsWith("/") ? v : `/${v}`;
    return `${assetOrigin}${path}`;
}

function makeValueRow(): OptionValueRow {
    return {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        valueName: "",
        addPrice: "0",
        stockQty: "",
    };
}

function makeGroupRow(): OptionGroupRow {
    return {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        groupName: "",
        values: [makeValueRow()],
    };
}

function serializeOptionGroups(groups: OptionGroupRow[]) {
    const normalized = groups
        .map((group) => ({
            groupName: group.groupName.trim(),
            values: group.values
                .map((value) => ({
                    valueName: value.valueName.trim(),
                    addPrice: value.addPrice.trim(),
                    stockQty: value.stockQty.trim(),
                }))
                .filter((value) => value.valueName),
        }))
        .filter((group) => group.groupName && group.values.length > 0);

    if (!normalized.length) return "";

    return normalized
        .map((group) => {
            const values = group.values
                .map((value) => {
                    const addPrice = value.addPrice === "" ? "0" : String(safeNum(value.addPrice, 0));
                    const stockQty = value.stockQty === "" ? "" : String(safeNum(value.stockQty, 0));
                    return [value.valueName, addPrice, stockQty].join("^");
                })
                .join(",");

            return `${group.groupName}|${values}`;
        })
        .join("|*|");
}

export default function ProductCreateForm({ tenants }: Props) {
    const defaultTenantSlug = useMemo(() => guessTenantSlug(tenants, "all"), [tenants]);

    const [form, setForm] = useState<FormState>({
        tenantSlug: defaultTenantSlug,
        status: "draft",

        title: "",
        name: "",
        price: 0,
        origPrice: 0,
        consumerPrice: 0,

        pickupOnly: true,
        displayUse: true,
        saleUse: true,

        image1: "",
        image2: "",
        image3: "",

        explains: "<p></p>",

        optionUse: false,

        minQty: "",
        maxQty: "",
    });

    const [optionGroups, setOptionGroups] = useState<OptionGroupRow[]>([]);
    const [uploadingKey, setUploadingKey] = useState<"image1" | "image2" | "image3" | null>(null);

    function onChange<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((p) => ({ ...p, [key]: value }));
    }

    function normalizeTitleInput(v: string) {
        return (v ?? "").toString();
    }

    function addOptionGroup() {
        setOptionGroups((prev) => [...prev, makeGroupRow()]);
        if (!form.optionUse) onChange("optionUse", true);
    }

    function updateOptionGroup(groupId: string, patch: Partial<OptionGroupRow>) {
        setOptionGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, ...patch } : group)));
    }

    function removeOptionGroup(groupId: string) {
        setOptionGroups((prev) => prev.filter((group) => group.id !== groupId));
    }

    function addOptionValue(groupId: string) {
        setOptionGroups((prev) =>
            prev.map((group) =>
                group.id === groupId ? { ...group, values: [...group.values, makeValueRow()] } : group
            )
        );
    }

    function updateOptionValue(groupId: string, valueId: string, patch: Partial<OptionValueRow>) {
        setOptionGroups((prev) =>
            prev.map((group) =>
                group.id === groupId
                    ? {
                        ...group,
                        values: group.values.map((value) =>
                            value.id === valueId ? { ...value, ...patch } : value
                        ),
                    }
                    : group
            )
        );
    }

    function removeOptionValue(groupId: string, valueId: string) {
        setOptionGroups((prev) =>
            prev.map((group) =>
                group.id === groupId
                    ? {
                        ...group,
                        values: group.values.filter((value) => value.id !== valueId),
                    }
                    : group
            )
        );
    }

    async function uploadImage(file: File, key: "image1" | "image2" | "image3") {
        setUploadingKey(key);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/proxy/admin/uploads/product-image", {
                method: "POST",
                body: formData,
                credentials: "include",
                cache: "no-store",
            });

            const json = await res.json().catch(() => ({}));

            if (!res.ok || json?.ok === false || !json?.path) {
                alert(json?.message || `이미지 업로드 실패 (HTTP ${res.status})`);
                return;
            }

            onChange(key, String(json.path));
        } finally {
            setUploadingKey(null);
        }
    }

    async function submit() {
        if (!form.tenantSlug?.trim()) return alert("지점을 선택해 주세요.(tenantSlug)");
        if (!form.title.trim()) return alert("상품명을 입력해 주세요.(title)");
        if (safeNum(form.price) <= 0) return alert("판매가를 입력해 주세요.");

        const serializedOptionInfo = form.optionUse ? serializeOptionGroups(optionGroups) : "";

        const payload: any = {
            tenantSlug: form.tenantSlug.trim(),
            status: String(form.status || "draft"),

            title: form.title.trim(),
            name: form.name?.trim() || form.title.trim(),

            basePrice: safeNum(form.price),
            price: safeNum(form.price),
            origPrice: safeNum(form.origPrice),
            orig_price: safeNum(form.origPrice),
            consumerPrice: safeNum(form.consumerPrice),
            consumer_price: safeNum(form.consumerPrice),

            pickupOnly: !!form.pickupOnly,
            pickup_only: form.pickupOnly ? 1 : 0,

            displayUse: !!form.displayUse,
            display_use: form.displayUse ? 1 : 0,

            saleUse: !!form.saleUse,
            sale_use: form.saleUse ? 1 : 0,

            image1: form.image1.trim(),
            image2: form.image2.trim(),
            image3: form.image3.trim(),
            thumbnailUrl: form.image1.trim(),

            description: form.explains ?? "",
            explains: form.explains ?? "",

            optionUse: !!form.optionUse,
            option_use: form.optionUse ? 1 : 0,
            optionInfo: serializedOptionInfo,
            option_info: serializedOptionInfo,

            minQty: form.minQty ? safeNum(form.minQty) : null,
            maxQty: form.maxQty ? safeNum(form.maxQty) : null,
            min_qty: form.minQty ? safeNum(form.minQty) : null,
            max_qty: form.maxQty ? safeNum(form.maxQty) : null,
        };

        const res = await fetch("/api/proxy/admin/products", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payload),
            cache: "no-store",
            credentials: "include",
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.ok === false) {
            console.error(json);
            return alert(json?.message || `등록 실패 (HTTP ${res.status})`);
        }

        alert("상품 등록이 완료되었습니다.");
        window.location.href = "/admin/products";
    }

    const preview1 = useMemo(() => toPreviewUrl(form.image1), [form.image1]);
    const preview2 = useMemo(() => toPreviewUrl(form.image2), [form.image2]);
    const preview3 = useMemo(() => toPreviewUrl(form.image3), [form.image3]);

    return (
        <div className="space-y-6">
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                    <label className="text-xs font-extrabold text-[var(--dad-muted)]">지점(tenant)</label>
                    <select
                        className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                        value={form.tenantSlug}
                        onChange={(e) => onChange("tenantSlug", e.target.value)}
                    >
                        {tenants.map((t) => {
                            const slug = (t.slug || "").toString().trim() || String(t.id);
                            const label = t.name ? `${t.name}${t.slug ? ` (${t.slug})` : ""}` : slug;
                            return (
                                <option key={slug} value={slug}>
                                    {label}
                                </option>
                            );
                        })}
                    </select>
                    <div className="mt-1 text-[11px] font-bold text-[var(--dad-muted)]">
                        현재: <span className="text-[var(--dad-ink)]">{form.tenantSlug || "-"}</span>
                    </div>
                </div>

                <div>
                    <label className="text-xs font-extrabold text-[var(--dad-muted)]">상태</label>
                    <select
                        className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                        value={form.status}
                        onChange={(e) => onChange("status", e.target.value)}
                    >
                        {PRODUCT_STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    <div className="mt-1 text-[11px] font-bold text-[var(--dad-muted)]">
                        현재: {statusLabel(form.status)}
                    </div>
                </div>
            </section>

            <section className="dad-card p-4 sm:p-5 space-y-4">
                <div>
                    <label className="text-xs font-extrabold text-[var(--dad-muted)]">
                        상품명(title) <span className="text-[var(--dad-orange)]">*</span>
                    </label>
                    <input
                        className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                        value={form.title}
                        onChange={(e) => {
                            const v = normalizeTitleInput(e.target.value);
                            onChange("title", v);
                            if (!form.name || form.name === form.title) onChange("name", v);
                        }}
                        placeholder="예: 홍삼원골드 100ml x 24포"
                    />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">판매가(price)</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.price}
                            onChange={(e) => onChange("price", safeNum(e.target.value))}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">공급가(orig_price)</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.origPrice}
                            onChange={(e) => onChange("origPrice", safeNum(e.target.value))}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">소비자가(consumer_price)</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.consumerPrice}
                            onChange={(e) => onChange("consumerPrice", safeNum(e.target.value))}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-extrabold">
                        <input
                            type="checkbox"
                            checked={form.pickupOnly}
                            onChange={(e) => onChange("pickupOnly", e.target.checked)}
                        />
                        픽업전용(pickup_only)
                    </label>
                    <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-extrabold">
                        <input
                            type="checkbox"
                            checked={form.displayUse}
                            onChange={(e) => onChange("displayUse", e.target.checked)}
                        />
                        진열함(display_use)
                    </label>
                    <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-extrabold">
                        <input
                            type="checkbox"
                            checked={form.saleUse}
                            onChange={(e) => onChange("saleUse", e.target.checked)}
                        />
                        판매함(sale_use)
                    </label>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                        {
                            key: "image1" as const,
                            label: "대표이미지(image1)",
                            value: form.image1,
                            preview: preview1,
                            placeholder: "예: /uploads/products/... 또는 https://...",
                        },
                        {
                            key: "image2" as const,
                            label: "목록이미지(image2)",
                            value: form.image2,
                            preview: preview2,
                            placeholder: "예: /uploads/products/... 또는 https://...",
                        },
                        {
                            key: "image3" as const,
                            label: "작은목록이미지(image3)",
                            value: form.image3,
                            preview: preview3,
                            placeholder: "예: /uploads/products/... 또는 https://...",
                        },
                    ].map((item) => (
                        <div key={item.key} className="space-y-2">
                            <label className="text-xs font-extrabold text-[var(--dad-muted)]">{item.label}</label>
                            <input
                                className="w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                                value={item.value}
                                onChange={(e) => onChange(item.key, e.target.value)}
                                placeholder={item.placeholder}
                            />
                            <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[var(--dad-border)] bg-white px-3 py-2 text-xs font-extrabold text-[var(--dad-ink)] hover:bg-[var(--dad-cream)]">
                                {uploadingKey === item.key ? "업로드 중..." : "파일 업로드"}
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={uploadingKey !== null}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        uploadImage(file, item.key);
                                        e.currentTarget.value = "";
                                    }}
                                />
                            </label>

                            <div className="rounded-2xl border border-[var(--dad-border)] overflow-hidden bg-white/70">
                                <div className="px-4 py-3 text-xs font-extrabold text-[var(--dad-muted)]">
                                    {item.key} 미리보기
                                </div>
                                <div className="aspect-[4/3] bg-[color:var(--dad-surface)]">
                                    {item.preview ? (
                                        <img src={item.preview} alt={`${item.key}-preview`} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-xs font-bold text-[var(--dad-muted)]">
                                            이미지 없음
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="dad-card p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-extrabold text-[var(--dad-ink)]">옵션</div>
                    <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-2 text-sm font-extrabold">
                            <input
                                type="checkbox"
                                checked={form.optionUse}
                                onChange={(e) => onChange("optionUse", e.target.checked)}
                            />
                            옵션 사용
                        </label>
                        <button
                            type="button"
                            className="dad-btn dad-btn-ghost h-9 px-3 text-sm"
                            onClick={addOptionGroup}
                        >
                            + 옵션명 추가
                        </button>
                    </div>
                </div>

                {!form.optionUse ? (
                    <div className="rounded-xl border border-dashed border-[var(--dad-border)] bg-white/50 px-4 py-6 text-center text-sm font-bold text-[var(--dad-muted)]">
                        옵션 사용을 체크하거나 옵션명 추가 버튼을 눌러주세요.
                    </div>
                ) : optionGroups.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--dad-border)] bg-white/50 px-4 py-6 text-center text-sm font-bold text-[var(--dad-muted)]">
                        등록된 옵션명이 없습니다. “옵션명 추가”를 눌러주세요.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {optionGroups.map((group) => (
                            <div
                                key={group.id}
                                className="rounded-2xl border border-[var(--dad-border)] bg-white/70 p-4"
                            >
                                <div className="mb-3 flex items-center gap-2">
                                    <input
                                        className="h-11 w-full max-w-[260px] rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold"
                                        value={group.groupName}
                                        onChange={(e) => updateOptionGroup(group.id, { groupName: e.target.value })}
                                        placeholder="옵션명 예: 색상"
                                    />

                                    <button
                                        type="button"
                                        className="dad-btn dad-btn-ghost h-10 px-3 text-sm"
                                        onClick={() => addOptionValue(group.id)}
                                    >
                                        + 옵션값 추가
                                    </button>

                                    <button
                                        type="button"
                                        className="dad-btn dad-btn-ghost h-10 px-3 text-sm"
                                        onClick={() => removeOptionGroup(group.id)}
                                    >
                                        옵션명 삭제
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {group.values.map((value) => (
                                        <div
                                            key={value.id}
                                            className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--dad-border)] bg-white p-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto]"
                                        >
                                            <div>
                                                <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">옵션값</div>
                                                <input
                                                    className="h-11 w-full rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold"
                                                    value={value.valueName}
                                                    onChange={(e) =>
                                                        updateOptionValue(group.id, value.id, { valueName: e.target.value })
                                                    }
                                                    placeholder="예: 레드"
                                                />
                                            </div>

                                            <div>
                                                <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">추가금액</div>
                                                <input
                                                    type="number"
                                                    className="h-11 w-full rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold"
                                                    value={value.addPrice}
                                                    onChange={(e) =>
                                                        updateOptionValue(group.id, value.id, { addPrice: e.target.value })
                                                    }
                                                    placeholder="0"
                                                />
                                            </div>

                                            <div>
                                                <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">재고</div>
                                                <input
                                                    type="number"
                                                    className="h-11 w-full rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold"
                                                    value={value.stockQty}
                                                    onChange={(e) =>
                                                        updateOptionValue(group.id, value.id, { stockQty: e.target.value })
                                                    }
                                                    placeholder="비우면 미지정"
                                                />
                                            </div>

                                            <div className="flex items-end">
                                                <button
                                                    type="button"
                                                    className="dad-btn dad-btn-ghost h-11 px-3 text-sm"
                                                    onClick={() => removeOptionValue(group.id, value.id)}
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="dad-card p-4 sm:p-5 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">최소구매(min_qty)</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.minQty}
                            onChange={(e) => onChange("minQty", e.target.value)}
                            placeholder="비우면 null"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">최대구매(max_qty)</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.maxQty}
                            onChange={(e) => onChange("maxQty", e.target.value)}
                            placeholder="비우면 null"
                        />
                    </div>
                </div>
            </section>

            <section className="dad-card p-4 sm:p-5 space-y-3">
                <div className="text-sm font-extrabold text-[var(--dad-ink)]">상세설명(explains / HTML)</div>
                <textarea
                    className="mt-2 h-52 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                    value={form.explains}
                    onChange={(e) => onChange("explains", e.target.value)}
                    placeholder="<p>상품 설명</p>"
                />

                <div className="rounded-2xl border border-[var(--dad-border)] bg-white/70 p-4">
                    <div className="text-xs font-extrabold text-[var(--dad-muted)]">미리보기(HTML 렌더)</div>
                    <div className="prose prose-sm mt-3 max-w-none" dangerouslySetInnerHTML={{ __html: form.explains || "" }} />
                </div>
            </section>

            <div className="flex items-center justify-end gap-2">
                <button className="dad-btn dad-btn-primary h-11 px-5 text-sm" onClick={submit}>
                    저장(등록)
                </button>
            </div>
        </div>
    );
}