"use client";

import { useMemo, useState } from "react";
import { PRODUCT_STATUS_OPTIONS, statusLabel } from "@/lib/admin/productStatus";
import ProductHtmlEditor from "./ProductHtmlEditor";
import {
    PRODUCT_ADMIN_CATEGORY_OPTIONS,
    OptionGroupRow,
    makeGroupRow,
    makeValueRow,
    safeNum,
    serializeOptionGroups,
    textToList,
    toPreviewUrl,
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

    categoryKeys: string[];
};

function guessTenantSlug(tenants: Tenant[], fallback = "all") {
    const first = tenants?.[0];
    const slug = (first?.slug || "").toString().trim();
    return slug || fallback;
}

export default function ProductCreateForm({ tenants }: Props) {
    const defaultTenantSlug = useMemo(() => guessTenantSlug(tenants, "all"), [tenants]);

    const [form, setForm] = useState<FormState>({
        tenantSlug: defaultTenantSlug,
        status: "draft",

        title: "",
        price: 0,
        origPrice: 0,
        consumerPrice: 0,

        pickupOnly: true,
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

        categoryKeys: [],
    });

    const [optionGroups, setOptionGroups] = useState<OptionGroupRow[]>([]);
    const [uploadingKey, setUploadingKey] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    function onChange<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((p) => ({ ...p, [key]: value }));
    }

    function toggleCategory(key: string) {
        setForm((prev) => ({
            ...prev,
            categoryKeys: prev.categoryKeys.includes(key)
                ? prev.categoryKeys.filter((x) => x !== key)
                : [...prev.categoryKeys, key],
        }));
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

    async function uploadSingleImage(key: "image1" | "image2" | "image3", file: File) {
        setUploadingKey(key);
        try {
            const path = await uploadProductImage(file);
            onChange(key, path);
        } catch (e: any) {
            alert(e?.message || "이미지 업로드 실패");
        } finally {
            setUploadingKey(null);
        }
    }

    async function appendImageToList(target: "otherImagesText" | "detailImagesText", file: File) {
        setUploadingKey(target);
        try {
            const path = await uploadProductImage(file);
            setForm((prev) => ({
                ...prev,
                [target]: prev[target] ? `${prev[target]}\n${path}` : path,
            }));
        } catch (e: any) {
            alert(e?.message || "이미지 업로드 실패");
        } finally {
            setUploadingKey(null);
        }
    }

    async function submit() {
        if (!form.tenantSlug.trim()) return alert("지점을 선택해 주세요.");
        if (!form.title.trim()) return alert("상품명을 입력해 주세요.");

        const serializedOptionInfo = form.optionUse ? serializeOptionGroups(optionGroups) : "";

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

            image1: form.image1.trim(),
            image2: form.image2.trim(),
            image3: form.image3.trim(),

            otherImages: textToList(form.otherImagesText),
            detailImages: textToList(form.detailImagesText),

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

            categoryKeys: form.categoryKeys,
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

            <section className="dad-card space-y-4 p-5">
                <div className="text-base font-extrabold text-[var(--dad-ink)]">기본 정보</div>

                <div>
                    <label className="text-xs font-extrabold text-[var(--dad-muted)]">상품명</label>
                    <input
                        className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                        value={form.title}
                        onChange={(e) => onChange("title", e.target.value)}
                        placeholder="예: 홍삼원골드 100ml x 24포"
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
                <div className="text-base font-extrabold text-[var(--dad-ink)]">판매/노출 설정</div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="rounded-xl border border-[var(--dad-border)] bg-white/70 p-4">
                        <div className="text-sm font-extrabold text-[var(--dad-ink)]">픽업 전용</div>
                        <div className="mt-1 text-xs font-bold text-[var(--dad-muted)]">배송 없이 매장 픽업만 허용</div>
                        <input
                            className="mt-3"
                            type="checkbox"
                            checked={form.pickupOnly}
                            onChange={(e) => onChange("pickupOnly", e.target.checked)}
                        />
                    </label>

                    <label className="rounded-xl border border-[var(--dad-border)] bg-white/70 p-4">
                        <div className="text-sm font-extrabold text-[var(--dad-ink)]">진열함</div>
                        <div className="mt-1 text-xs font-bold text-[var(--dad-muted)]">목록에 노출</div>
                        <input
                            className="mt-3"
                            type="checkbox"
                            checked={form.displayUse}
                            onChange={(e) => onChange("displayUse", e.target.checked)}
                        />
                    </label>

                    <label className="rounded-xl border border-[var(--dad-border)] bg-white/70 p-4">
                        <div className="text-sm font-extrabold text-[var(--dad-ink)]">판매함</div>
                        <div className="mt-1 text-xs font-bold text-[var(--dad-muted)]">실제 주문 가능 상태</div>
                        <input
                            className="mt-3"
                            type="checkbox"
                            checked={form.saleUse}
                            onChange={(e) => onChange("saleUse", e.target.checked)}
                        />
                    </label>

                    <div className="rounded-xl border border-[var(--dad-border)] bg-white/70 p-4">
                        <div className="text-sm font-extrabold text-[var(--dad-ink)]">카테고리(임시)</div>
                        <div className="mt-1 text-xs font-bold text-[var(--dad-muted)]">
                            오늘의공구/바로픽업가능 다중 선택
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {PRODUCT_ADMIN_CATEGORY_OPTIONS.map((item) => (
                                <label
                                    key={item.key}
                                    className="inline-flex items-center gap-2 rounded-full border border-[var(--dad-border)] bg-white px-3 py-2 text-xs font-bold"
                                >
                                    <input
                                        type="checkbox"
                                        checked={form.categoryKeys.includes(item.key)}
                                        onChange={() => toggleCategory(item.key)}
                                    />
                                    {item.label}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

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
                            <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[var(--dad-border)] bg-white px-3 py-2 text-xs font-extrabold">
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
                            {uploadingKey === "otherImagesText" ? "업로드 중..." : "추가이미지 업로드"}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    appendImageToList("otherImagesText", file);
                                    e.currentTarget.value = "";
                                }}
                            />
                        </label>
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
                            {uploadingKey === "detailImagesText" ? "업로드 중..." : "상세이미지 업로드"}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    appendImageToList("detailImagesText", file);
                                    e.currentTarget.value = "";
                                }}
                            />
                        </label>
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

            <div className="flex justify-end">
                <button className="dad-btn dad-btn-primary h-11 px-5 text-sm" onClick={submit} disabled={saving}>
                    {saving ? "저장 중..." : "저장(등록)"}
                </button>
            </div>
        </div>
    );
}