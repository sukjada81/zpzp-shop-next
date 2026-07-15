// src/components/admin/products/ProductCreateForm.tsx
"use client";

import { useMemo, useState } from "react";
import { PRODUCT_STATUS_OPTIONS, statusLabel } from "@/lib/admin/productStatus";
import ProductHtmlEditor from "./ProductHtmlEditor";
import {
    PRODUCT_ADMIN_CATEGORY_OPTIONS,
    OptionGroupRow,
    categoryKeysFromCateCode,
    makeGroupRow,
    makeValueRow,
    safeNum,
    serializeOptionGroups,
    textToList,
    toPreviewUrl,
    toStoredPath,
    uploadProductImage,
} from "./productFormUtils";

type Tenant = { id: string | number; slug?: string; name?: string };

type Props = {
    tenants: Tenant[];
};

type FormState = {
    tenantSlug: string;
    status: string;

    title: string;
    price: number;
    origPrice: number;
    consumerPrice: number;

    pickupOnly: boolean;
    displayUse: boolean;
    saleUse: boolean;

    image1: string;
    image2: string;
    image3: string;

    otherImagesText: string;
    detailImagesText: string;

    detail: string;
    explains: string;

    optionUse: boolean;

    minQty: string;
    maxQty: string;

    saleStartAt: string;
    saleEndAt: string;
    sortOrder: string;

    qtyType: "0" | "1";
    qty: string;
    limitQty: string;

    goodsCode: string;
    brand: string;
    make: string;
    origin: string;
    model: string;

    detailImageOnly: boolean;
    detailImageType: "1" | "2";

    cateCode: string;
};

function guessTenantSlug(tenants: Tenant[], fallback = "hq") {
    const first = tenants?.[0];
    const slug = (first?.slug || "").toString().trim();
    return slug || fallback;
}

function removeImageFromText(text: string, target: string) {
    return text
        .split(/\r?\n|,/g)
        .map((x) => x.trim())
        .filter(Boolean)
        .filter((x) => x !== target)
        .join("\n");
}

function SettingToggleCard({
                               title,
                               description,
                               checked,
                               onChange,
                           }: {
    title: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <div className="rounded-2xl border border-[var(--dad-border)] bg-white px-4 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="text-sm font-extrabold text-[var(--dad-ink)]">{title}</div>
                    <div className="mt-1 text-xs font-semibold leading-relaxed text-[var(--dad-muted)]">
                        {description}
                    </div>
                </div>

                <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    onClick={() => onChange(!checked)}
                    className={[
                        "relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors overflow-hidden",
                        checked ? "bg-[var(--dad-orange)]" : "bg-slate-300",
                    ].join(" ")}
                >
                    <span
                        className={[
                            "absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform",
                            checked ? "translate-x-5" : "translate-x-0",
                        ].join(" ")}
                    />
                </button>
            </div>
        </div>
    );
}

export default function ProductCreateForm({ tenants }: Props) {
    const defaultTenantSlug = useMemo(() => guessTenantSlug(tenants, "hq"), [tenants]);

    const [form, setForm] = useState<FormState>({
        tenantSlug: defaultTenantSlug,
        status: "draft",

        title: "",
        price: 0,
        origPrice: 0,
        consumerPrice: 0,

        pickupOnly: false,
        displayUse: true,
        saleUse: true,

        image1: "",
        image2: "",
        image3: "",

        otherImagesText: "",
        detailImagesText: "",

        detail: "",
        explains: "<p></p>",

        optionUse: false,

        minQty: "",
        maxQty: "",

        saleStartAt: "",
        saleEndAt: "",
        sortOrder: "0",

        qtyType: "0",
        qty: "",
        limitQty: "",

        goodsCode: "",
        brand: "",
        make: "",
        origin: "",
        model: "",

        detailImageOnly: false,
        detailImageType: "1",

        cateCode: "0",
    });

    const [optionGroups, setOptionGroups] = useState<OptionGroupRow[]>([]);
    const [uploadingKey, setUploadingKey] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    function onChange<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((p) => ({ ...p, [key]: value }));
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

    function updateOptionValue(groupId: string, valueId: string, patch: any) {
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
                    ? { ...group, values: group.values.filter((value) => value.id !== valueId) }
                    : group
            )
        );
    }

    function clearSingleImage(key: "image1" | "image2" | "image3") {
        onChange(key, "");
    }

    async function uploadSingleImage(key: "image1" | "image2" | "image3", file: File) {
        setUploadingKey(key);
        try {
            const path = await uploadProductImage(file);

            setForm((prev) => {
                const next: FormState = { ...prev, [key]: path };

                if (key === "image1") {
                    if (!prev.image2) next.image2 = path;
                    if (!prev.image3) next.image3 = path;
                }

                return next;
            });
        } catch (e: any) {
            alert(e?.message || "이미지 업로드 실패");
        } finally {
            setUploadingKey(null);
        }
    }

    async function appendImageToList(
        target: "otherImagesText" | "detailImagesText",
        files: FileList | File[]
    ) {
        const fileArray = Array.from(files ?? []);
        if (!fileArray.length) return;

        setUploadingKey(target);
        try {
            const uploadedPaths: string[] = [];

            for (const file of fileArray) {
                const path = await uploadProductImage(file);
                uploadedPaths.push(path);
            }

            setForm((prev) => {
                const current = textToList(prev[target]);
                const nextList = [...current, ...uploadedPaths];
                return {
                    ...prev,
                    [target]: nextList.join("\n"),
                };
            });
        } catch (e: any) {
            alert(e?.message || "이미지 업로드 실패");
        } finally {
            setUploadingKey(null);
        }
    }

    function removeListImage(target: "otherImagesText" | "detailImagesText", path: string) {
        setForm((prev) => ({
            ...prev,
            [target]: removeImageFromText(prev[target], path),
        }));
    }

    async function submit() {
        if (!form.tenantSlug.trim()) return alert("지점을 선택해 주세요.");
        if (!form.title.trim()) return alert("상품명을 입력해 주세요.");

        const serializedOptionInfo = form.optionUse ? serializeOptionGroups(optionGroups) : "";
        const cateNumber = safeNum(form.cateCode, 0);
        const categoryKeys = categoryKeysFromCateCode(form.cateCode);

        const payload = {
            tenantSlug: form.tenantSlug.trim(),
            status: form.status,

            title: form.title.trim(),

            basePrice: safeNum(form.price),
            price: safeNum(form.price),
            origPrice: safeNum(form.origPrice),
            orig_price: safeNum(form.origPrice),
            consumerPrice: safeNum(form.consumerPrice),
            consumer_price: safeNum(form.consumerPrice),

            pickupOnly: form.pickupOnly,
            pickup_only: form.pickupOnly ? 1 : 0,

            displayUse: form.displayUse,
            display_use: form.displayUse ? 1 : 0,

            saleUse: form.saleUse,
            sale_use: form.saleUse ? 1 : 0,

            image1: form.image1.trim() ? toStoredPath(form.image1.trim()) : "",
            image2: form.image2.trim() ? toStoredPath(form.image2.trim()) : "",
            image3: form.image3.trim() ? toStoredPath(form.image3.trim()) : "",

            otherImages: textToList(form.otherImagesText).map(toStoredPath),
            other_image: textToList(form.otherImagesText).map(toStoredPath),
            detailImages: textToList(form.detailImagesText).map(toStoredPath),
            detail_image: textToList(form.detailImagesText).map(toStoredPath),

            detail: form.detail,
            shortDescription: form.detail,
            explains: form.explains,
            description: form.explains,

            optionUse: form.optionUse,
            option_use: form.optionUse ? 1 : 0,
            optionInfo: serializedOptionInfo,
            option_info: serializedOptionInfo,

            minQty: form.minQty === "" ? null : safeNum(form.minQty),
            maxQty: form.maxQty === "" ? null : safeNum(form.maxQty),

            saleStartAt: form.saleStartAt || null,
            saleEndAt: form.saleEndAt || null,
            sortOrder: safeNum(form.sortOrder),

            qtyType: safeNum(form.qtyType),
            qty: safeNum(form.qty),
            limitQty: safeNum(form.limitQty),

            goodsCode: form.goodsCode.trim(),
            brand: form.brand.trim(),
            make: form.make.trim(),
            origin: form.origin.trim(),
            model: form.model.trim(),

            detailImageOnly: form.detailImageOnly,
            detailImageType: safeNum(form.detailImageType),

            cate: cateNumber,
            categoryKeys,
        };

        setSaving(true);
        try {
            const res = await fetch("/api/proxy/admin/products", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(payload),
                cache: "no-store",
                credentials: "include",
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok || json?.ok === false) {
                throw new Error(json?.message || `등록 실패 (HTTP ${res.status})`);
            }

            alert("상품 등록이 완료되었습니다.");
            window.location.href = "/admin/products";
        } catch (e: any) {
            alert(e?.message || "등록 실패");
        } finally {
            setSaving(false);
        }
    }

    const preview1 = useMemo(() => toPreviewUrl(form.image1), [form.image1]);
    const preview2 = useMemo(() => toPreviewUrl(form.image2), [form.image2]);
    const preview3 = useMemo(() => toPreviewUrl(form.image3), [form.image3]);

    const otherImageList = useMemo(() => textToList(form.otherImagesText), [form.otherImagesText]);
    const detailImageList = useMemo(() => textToList(form.detailImagesText), [form.detailImagesText]);

    return (
        <div className="space-y-6">
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                    <label className="text-xs font-extrabold text-[var(--dad-muted)]">지점</label>
                    <select
                        className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                        value={form.tenantSlug}
                        onChange={(e) => onChange("tenantSlug", e.target.value)}
                    >
                        <option value="hq">본사 상품 (tenant_id = 0)</option>

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

            <section className="dad-card space-y-5 p-5">
                <div className="text-base font-extrabold text-[var(--dad-ink)]">기본 정보</div>

                <div>
                    <label className="text-xs font-extrabold text-[var(--dad-muted)]">카테고리</label>
                    <select
                        className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white px-3 py-3 text-sm font-bold"
                        value={form.cateCode}
                        onChange={(e) => onChange("cateCode", e.target.value)}
                    >
                        <option value="0">선택 안함</option>
                        {PRODUCT_ADMIN_CATEGORY_OPTIONS.map((item) => (
                            <option key={item.code} value={item.code}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-xs font-extrabold text-[var(--dad-muted)]">상품명</label>
                    <input
                        className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                        value={form.title}
                        onChange={(e) => onChange("title", e.target.value)}
                        placeholder="예: A지점 오늘의 공구 상품"
                    />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <SettingToggleCard
                        title="픽업 전용"
                        description="배송 없이 매장 픽업 주문만 받습니다."
                        checked={form.pickupOnly}
                        onChange={(checked) => onChange("pickupOnly", checked)}
                    />
                    <SettingToggleCard
                        title="진열함"
                        description="유저 상품 목록과 홈 화면에 노출합니다."
                        checked={form.displayUse}
                        onChange={(checked) => onChange("displayUse", checked)}
                    />
                    <SettingToggleCard
                        title="판매함"
                        description="실제 주문 가능한 상태로 처리합니다."
                        checked={form.saleUse}
                        onChange={(checked) => onChange("saleUse", checked)}
                    />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {[
                        ["goodsCode", "자체상품코드"],
                        ["brand", "브랜드"],
                        ["make", "제조사"],
                        ["origin", "원산지"],
                        ["model", "모델명"],
                    ].map(([key, label]) => (
                        <div key={key}>
                            <label className="text-xs font-extrabold text-[var(--dad-muted)]">{label}</label>
                            <input
                                className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                                value={(form as any)[key]}
                                onChange={(e) => onChange(key as any, e.target.value as any)}
                            />
                        </div>
                    ))}
                </div>

                <div>
                    <label className="text-xs font-extrabold text-[var(--dad-muted)]">간략설명(detail)</label>
                    <textarea
                        className="mt-2 min-h-[90px] w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-semibold"
                        value={form.detail}
                        onChange={(e) => onChange("detail", e.target.value)}
                        placeholder="목록/상단에 보여줄 짧은 설명"
                    />
                </div>
            </section>

            <section className="dad-card space-y-4 p-5">
                <div className="text-base font-extrabold text-[var(--dad-ink)]">판매 정보</div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">판매가</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.price}
                            onChange={(e) => onChange("price", safeNum(e.target.value))}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">공급가</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.origPrice}
                            onChange={(e) => onChange("origPrice", safeNum(e.target.value))}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">소비자가</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.consumerPrice}
                            onChange={(e) => onChange("consumerPrice", safeNum(e.target.value))}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">최소구매수량</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.minQty}
                            onChange={(e) => onChange("minQty", e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">최대구매수량</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.maxQty}
                            onChange={(e) => onChange("maxQty", e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">재고 타입</label>
                        <select
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.qtyType}
                            onChange={(e) => onChange("qtyType", e.target.value as "0" | "1")}
                        >
                            <option value="0">한정판매</option>
                            <option value="1">무제한</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">재고수량</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.qty}
                            onChange={(e) => onChange("qty", e.target.value)}
                            disabled={form.qtyType === "1"}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">구매제한수량</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.limitQty}
                            onChange={(e) => onChange("limitQty", e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">판매 시작일시</label>
                        <input
                            type="datetime-local"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.saleStartAt}
                            onChange={(e) => onChange("saleStartAt", e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">판매 종료일시</label>
                        <input
                            type="datetime-local"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.saleEndAt}
                            onChange={(e) => onChange("saleEndAt", e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">정렬 우선순위</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.sortOrder}
                            onChange={(e) => onChange("sortOrder", e.target.value)}
                        />
                    </div>
                </div>
            </section>

            <section className="dad-card p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="text-base font-extrabold text-[var(--dad-ink)]">옵션</div>
                    <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-2 text-sm font-extrabold">
                            <input
                                type="checkbox"
                                checked={form.optionUse}
                                onChange={(e) => onChange("optionUse", e.target.checked)}
                            />
                            옵션 사용
                        </label>
                        <button type="button" className="dad-btn dad-btn-ghost h-9 px-3 text-sm" onClick={addOptionGroup}>
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
                        등록된 옵션명이 없습니다.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {optionGroups.map((group) => (
                            <div key={group.id} className="rounded-2xl border border-[var(--dad-border)] bg-white/70 p-4">
                                <div className="mb-3 flex items-center gap-2">
                                    <input
                                        className="h-11 w-full max-w-[260px] rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold"
                                        value={group.groupName}
                                        onChange={(e) => updateOptionGroup(group.id, { groupName: e.target.value })}
                                        placeholder="옵션명 예: 색상"
                                    />
                                    <button type="button" className="dad-btn dad-btn-ghost h-10 px-3 text-sm" onClick={() => addOptionValue(group.id)}>
                                        + 옵션값 추가
                                    </button>
                                    <button type="button" className="dad-btn dad-btn-ghost h-10 px-3 text-sm" onClick={() => removeOptionGroup(group.id)}>
                                        옵션명 삭제
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {group.values.map((value) => (
                                        <div
                                            key={value.id}
                                            className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--dad-border)] bg-white p-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto]"
                                        >
                                            <input
                                                className="h-11 rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold"
                                                value={value.valueName}
                                                onChange={(e) =>
                                                    updateOptionValue(group.id, value.id, { valueName: e.target.value })
                                                }
                                                placeholder="옵션값"
                                            />
                                            <input
                                                type="number"
                                                className="h-11 rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold"
                                                value={value.addPrice}
                                                onChange={(e) =>
                                                    updateOptionValue(group.id, value.id, { addPrice: e.target.value })
                                                }
                                                placeholder="추가금액"
                                            />
                                            <input
                                                type="number"
                                                className="h-11 rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold"
                                                value={value.stockQty}
                                                onChange={(e) =>
                                                    updateOptionValue(group.id, value.id, { stockQty: e.target.value })
                                                }
                                                placeholder="재고"
                                            />
                                            <button
                                                type="button"
                                                className="dad-btn dad-btn-ghost h-11 px-3 text-sm"
                                                onClick={() => removeOptionValue(group.id, value.id)}
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="dad-card space-y-4 p-5">
                <div className="text-base font-extrabold text-[var(--dad-ink)]">이미지</div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                        { key: "image1", label: "대표이미지(image1)", preview: preview1 },
                        { key: "image2", label: "목록이미지(image2)", preview: preview2 },
                        { key: "image3", label: "작은목록이미지(image3)", preview: preview3 },
                    ].map((item) => (
                        <div key={item.key} className="space-y-2">
                            <label className="text-xs font-extrabold text-[var(--dad-muted)]">{item.label}</label>
                            <input
                                className="w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                                value={(form as any)[item.key]}
                                onChange={(e) => onChange(item.key as any, e.target.value as any)}
                            />
                            <div className="flex gap-2">
                                <label className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-[var(--dad-border)] bg-white px-3 py-2 text-xs font-extrabold">
                                    {uploadingKey === item.key ? "업로드 중..." : "파일 업로드"}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            uploadSingleImage(item.key as any, file);
                                            e.currentTarget.value = "";
                                        }}
                                    />
                                </label>

                                <button
                                    type="button"
                                    className="rounded-xl border border-[var(--dad-border)] bg-white px-3 py-2 text-xs font-extrabold text-red-600 disabled:opacity-40"
                                    disabled={!(form as any)[item.key]}
                                    onClick={() => clearSingleImage(item.key as "image1" | "image2" | "image3")}
                                >
                                    삭제
                                </button>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-[var(--dad-border)] bg-white/70">
                                <div className="aspect-[4/3] bg-[color:var(--dad-surface)]">
                                    {item.preview ? (
                                        <img src={item.preview} alt="" className="h-full w-full object-cover" />
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">추가이미지(other_image)</label>
                        <textarea
                            className="mt-2 min-h-[120px] w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-semibold"
                            value={form.otherImagesText}
                            onChange={(e) => onChange("otherImagesText", e.target.value)}
                            placeholder={"한 줄에 하나씩 입력\nuploads/products/a.jpg\nuploads/products/b.jpg"}
                        />
                        <label className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-xl border border-[var(--dad-border)] bg-white px-3 py-2 text-xs font-extrabold">
                            {uploadingKey === "otherImagesText" ? "업로드 중..." : "추가이미지 여러장 업로드"}
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                    const files = e.target.files;
                                    if (!files?.length) return;
                                    appendImageToList("otherImagesText", files);
                                    e.currentTarget.value = "";
                                }}
                            />
                        </label>

                        {otherImageList.length ? (
                            <div className="mt-3 grid grid-cols-2 gap-3">
                                {otherImageList.map((path, idx) => (
                                    <div key={`${path}_${idx}`} className="rounded-2xl border border-[var(--dad-border)] bg-white p-2">
                                        <div className="overflow-hidden rounded-xl border border-[var(--dad-border)]">
                                            <div className="aspect-[4/3] bg-[color:var(--dad-surface)]">
                                                <img
                                                    src={toPreviewUrl(path)}
                                                    alt=""
                                                    className="h-full w-full object-cover"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white px-3 py-2 text-xs font-extrabold text-red-600"
                                            onClick={() => removeListImage("otherImagesText", path)}
                                        >
                                            삭제
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">상세설명 이미지(detail_image)</label>
                        <textarea
                            className="mt-2 min-h-[120px] w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-semibold"
                            value={form.detailImagesText}
                            onChange={(e) => onChange("detailImagesText", e.target.value)}
                            placeholder={"한 줄에 하나씩 입력\nuploads/products/detail1.jpg\nuploads/products/detail2.jpg"}
                        />
                        <label className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-xl border border-[var(--dad-border)] bg-white px-3 py-2 text-xs font-extrabold">
                            {uploadingKey === "detailImagesText" ? "업로드 중..." : "상세이미지 여러장 업로드"}
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                    const files = e.target.files;
                                    if (!files?.length) return;
                                    appendImageToList("detailImagesText", files);
                                    e.currentTarget.value = "";
                                }}
                            />
                        </label>

                        {detailImageList.length ? (
                            <div className="mt-3 grid grid-cols-2 gap-3">
                                {detailImageList.map((path, idx) => (
                                    <div key={`${path}_${idx}`} className="rounded-2xl border border-[var(--dad-border)] bg-white p-2">
                                        <div className="overflow-hidden rounded-xl border border-[var(--dad-border)]">
                                            <div className="aspect-[4/3] bg-[color:var(--dad-surface)]">
                                                <img
                                                    src={toPreviewUrl(path)}
                                                    alt=""
                                                    className="h-full w-full object-cover"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white px-3 py-2 text-xs font-extrabold text-red-600"
                                            onClick={() => removeListImage("detailImagesText", path)}
                                        >
                                            삭제
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--dad-border)] bg-white/70 px-4 py-3 text-sm font-extrabold">
                        <input
                            type="checkbox"
                            checked={form.detailImageOnly}
                            onChange={(e) => onChange("detailImageOnly", e.target.checked)}
                        />
                        상세설명을 이미지로만 사용
                    </label>

                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">상세이미지 출력방식</label>
                        <select
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.detailImageType}
                            onChange={(e) => onChange("detailImageType", e.target.value as "1" | "2")}
                        >
                            <option value="1">이미지간 공백 있음</option>
                            <option value="2">이미지간 공백 없음</option>
                        </select>
                    </div>
                </div>
            </section>

            <section className="dad-card p-5">
                <ProductHtmlEditor
                    label="상세설명(explains / HTML)"
                    value={form.explains}
                    onChange={(html: string) => onChange("explains", html)}
                    height={360}
                />
            </section>

            <div className="flex justify-end">
                <button className="dad-btn dad-btn-primary h-11 px-5 text-sm" onClick={submit} disabled={saving}>
                    {saving ? "저장 중..." : "저장(등록)"}
                </button>
            </div>
        </div>
    );
}