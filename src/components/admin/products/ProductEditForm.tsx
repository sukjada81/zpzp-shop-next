// src/components/admin/products/ProductEditForm.tsx
"use client";

import { Dispatch, SetStateAction, useMemo, useState } from "react";
import { PRODUCT_STATUS_OPTIONS, statusLabel } from "@/lib/admin/productStatus";
import ProductHtmlEditor from "./ProductHtmlEditor";
import {
    PRODUCT_ADMIN_CATEGORY_OPTIONS,
    OptionGroupRow,
    cateCodeFromCategoryKeys,
    listToText,
    makeGroupRow,
    makeValueRow,
    parseOptionInfo,
    safeNum,
    serializeOptionGroups,
    textToList,
    toPreviewUrl,
    toStoredPath,
    uploadProductImage,
} from "./productFormUtils";

type Tenant = {
    id: string | number;
    slug?: string | null;
    name?: string | null;
};

type StringSetter = Dispatch<SetStateAction<string>>;

type BaseFieldRow = {
    key: string;
    value: string;
    setter: StringSetter;
    label: string;
};

function removeImageFromText(text: string, target: string) {
    return text
        .split(/\r?\n|,/g)
        .map((x) => x.trim())
        .filter(Boolean)
        .filter((x) => x !== target)
        .join("\n");
}

function toTenantSlugFromProduct(product: any, tenants: Tenant[]) {
    const tenantSlug = String(product?.tenantSlug ?? "").trim();
    if (tenantSlug) return tenantSlug;

    const tenantId = Number(product?.tenantId ?? product?.tenant_id ?? NaN);
    if (Number.isFinite(tenantId)) {
        if (tenantId === 0) return "hq";

        const matched = tenants.find((t) => Number(t.id) === tenantId);
        if (matched?.slug) return String(matched.slug).trim();
    }

    return "hq";
}

function resolveInitialCateCode(product: any) {
    const rawCate = product?.cate;
    if (rawCate !== undefined && rawCate !== null && String(rawCate).trim() !== "") {
        return String(rawCate);
    }

    return cateCodeFromCategoryKeys(product?.categoryKeys);
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

export default function ProductEditForm({
                                            product,
                                            tenants,
                                        }: {
    product: any;
    tenants: Tenant[];
}) {
    const productId = useMemo(() => String(product?.id ?? ""), [product?.id]);
    const initialTenantSlug = useMemo(() => toTenantSlugFromProduct(product, tenants), [product, tenants]);

    const [tenantSlug, setTenantSlug] = useState<string>(initialTenantSlug);
    const [title, setTitle] = useState<string>(product?.title ?? "");
    const [status, setStatus] = useState<string>(product?.status ?? "draft");

    const [price, setPrice] = useState<number>(Number(product?.price ?? product?.basePrice ?? 0));
    const [origPrice, setOrigPrice] = useState<number>(Number(product?.origPrice ?? 0));
    const [consumerPrice, setConsumerPrice] = useState<number>(Number(product?.consumerPrice ?? 0));

    const [pickupOnly, setPickupOnly] = useState<boolean>(Boolean(product?.pickupOnly ?? true));
    const [displayUse, setDisplayUse] = useState<boolean>(Boolean(product?.displayUse ?? true));
    const [saleUse, setSaleUse] = useState<boolean>(Boolean(product?.saleUse ?? true));

    const [image1, setImage1] = useState<string>(product?.image1 ?? "");
    const [image2, setImage2] = useState<string>(product?.image2 ?? "");
    const [image3, setImage3] = useState<string>(product?.image3 ?? "");

    const [otherImagesText, setOtherImagesText] = useState<string>(listToText(product?.otherImages ?? []));
    const [detailImagesText, setDetailImagesText] = useState<string>(listToText(product?.detailImages ?? []));

    const [detail, setDetail] = useState<string>(product?.detail ?? product?.shortDescription ?? "");
    const [explains, setExplains] = useState<string>(product?.explains ?? product?.description ?? "<p></p>");

    const [minQty, setMinQty] = useState<string>(product?.minQty == null ? "" : String(product.minQty));
    const [maxQty, setMaxQty] = useState<string>(product?.maxQty == null ? "" : String(product.maxQty));
    const [saleStartAt, setSaleStartAt] = useState<string>(
        product?.saleStartAt ? String(product.saleStartAt).slice(0, 16) : ""
    );
    const [saleEndAt, setSaleEndAt] = useState<string>(
        product?.saleEndAt ? String(product.saleEndAt).slice(0, 16) : ""
    );
    const [alwaysOnSale, setAlwaysOnSale] = useState<boolean>(
        !product?.saleStartAt && !product?.saleEndAt
    );
    const [sortOrder, setSortOrder] = useState<string>(String(product?.sortOrder ?? 0));

    const [qtyType, setQtyType] = useState<"0" | "1">(String(product?.qtyType ?? 0) === "1" ? "1" : "0");
    const [qty, setQty] = useState<string>(String(product?.qty ?? 0));
    const [limitQty, setLimitQty] = useState<string>(String(product?.limitQty ?? 0));

    const [goodsCode, setGoodsCode] = useState<string>(product?.goodsCode ?? "");
    const [brand, setBrand] = useState<string>(product?.brand ?? "");
    const [make, setMake] = useState<string>(product?.make ?? "");
    const [origin, setOrigin] = useState<string>(product?.origin ?? "");
    const [model, setModel] = useState<string>(product?.model ?? "");

    const [detailImageOnly, setDetailImageOnly] = useState<boolean>(Boolean(product?.detailImageOnly ?? false));
    const [detailImageType, setDetailImageType] = useState<"1" | "2">(
        String(product?.detailImageType ?? 1) === "2" ? "2" : "1"
    );

    const [cateCode, setCateCode] = useState<string>(resolveInitialCateCode(product));

    const [optionUse, setOptionUse] = useState<boolean>(Boolean(product?.optionUse ?? false));
    const [optionGroups, setOptionGroups] = useState<OptionGroupRow[]>(() =>
        parseOptionInfo(product?.optionInfo ?? "")
    );

    const [uploadingKey, setUploadingKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const preview1 = useMemo(() => toPreviewUrl(image1), [image1]);
    const preview2 = useMemo(() => toPreviewUrl(image2), [image2]);
    const preview3 = useMemo(() => toPreviewUrl(image3), [image3]);

    const otherImageList = useMemo(() => textToList(otherImagesText), [otherImagesText]);
    const detailImageList = useMemo(() => textToList(detailImagesText), [detailImagesText]);

    const baseFieldRows: BaseFieldRow[] = [
        { key: "goodsCode", value: goodsCode, setter: setGoodsCode, label: "자체상품코드" },
        { key: "brand", value: brand, setter: setBrand, label: "브랜드" },
        { key: "make", value: make, setter: setMake, label: "제조사" },
        { key: "origin", value: origin, setter: setOrigin, label: "원산지" },
        { key: "model", value: model, setter: setModel, label: "모델명" },
    ];

    function addOptionGroup() {
        setOptionGroups((prev) => [...prev, makeGroupRow()]);
        if (!optionUse) setOptionUse(true);
    }

    function updateOptionGroup(groupId: string, patch: Partial<OptionGroupRow>) {
        setOptionGroups((prev) =>
            prev.map((group) => (group.id === groupId ? { ...group, ...patch } : group))
        );
    }

    function removeOptionGroup(groupId: string) {
        setOptionGroups((prev) => prev.filter((group) => group.id !== groupId));
    }

    function addOptionValue(groupId: string) {
        setOptionGroups((prev) =>
            prev.map((group) =>
                group.id === groupId
                    ? { ...group, values: [...group.values, makeValueRow()] }
                    : group
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
        if (key === "image1") setImage1("");
        if (key === "image2") setImage2("");
        if (key === "image3") setImage3("");
    }

    async function uploadSingleImage(setter: (v: string) => void, key: string, file: File) {
        setUploadingKey(key);

        try {
            const path = await uploadProductImage(file);

            setter(path);

            if (key === "image1") {
                if (!image2) setImage2(path);
                if (!image3) setImage3(path);
            }
        } catch (e: any) {
            alert(e?.message || "이미지 업로드 실패");
        } finally {
            setUploadingKey(null);
        }
    }

    async function appendImageToList(target: "other" | "detail", files: FileList | File[]) {
        const fileArray = Array.from(files ?? []);
        if (!fileArray.length) return;

        setUploadingKey(target);
        try {
            const uploadedPaths: string[] = [];

            for (const file of fileArray) {
                const path = await uploadProductImage(file);
                uploadedPaths.push(path);
            }

            if (target === "other") {
                setOtherImagesText((prev) => [...textToList(prev), ...uploadedPaths].join("\n"));
            } else {
                setDetailImagesText((prev) => [...textToList(prev), ...uploadedPaths].join("\n"));
            }
        } catch (e: any) {
            alert(e?.message || "이미지 업로드 실패");
        } finally {
            setUploadingKey(null);
        }
    }

    function removeListImage(target: "other" | "detail", path: string) {
        if (target === "other") {
            setOtherImagesText((prev) => removeImageFromText(prev, path));
        } else {
            setDetailImagesText((prev) => removeImageFromText(prev, path));
        }
    }

    async function save() {
        setErr(null);

        if (!productId || !/^\d+$/.test(productId)) {
            setErr("상품 ID가 올바르지 않습니다.");
            return;
        }

        if (!tenantSlug.trim()) {
            setErr("지점을 선택해주세요.");
            return;
        }

        if (!title.trim()) {
            setErr("상품명을 입력해주세요.");
            return;
        }

        const serializedOptionInfo = optionUse ? serializeOptionGroups(optionGroups) : "";
        const cateNumber = safeNum(cateCode, 0);
        const categoryKeys = PRODUCT_ADMIN_CATEGORY_OPTIONS
            .filter((item) => item.code === cateCode)
            .map((item) => item.key);

        setLoading(true);
        try {
            const res = await fetch(`/api/proxy/admin/products/${encodeURIComponent(productId)}`, {
                method: "PUT",
                headers: {
                    "content-type": "application/json",
                    accept: "application/json",
                },
                credentials: "include",
                cache: "no-store",
                body: JSON.stringify({
                    tenantSlug: tenantSlug.trim(),

                    title: title.trim(),
                    status,

                    basePrice: safeNum(price),
                    price: safeNum(price),
                    origPrice: safeNum(origPrice),
                    orig_price: safeNum(origPrice),
                    consumerPrice: safeNum(consumerPrice),
                    consumer_price: safeNum(consumerPrice),

                    pickupOnly,
                    pickup_only: pickupOnly ? 1 : 0,

                    displayUse,
                    display_use: displayUse ? 1 : 0,

                    saleUse,
                    sale_use: saleUse ? 1 : 0,

                    minQty: minQty === "" ? null : safeNum(minQty),
                    min_qty: minQty === "" ? null : safeNum(minQty),
                    maxQty: maxQty === "" ? null : safeNum(maxQty),
                    max_qty: maxQty === "" ? null : safeNum(maxQty),

                    saleStartAt: alwaysOnSale ? null : (saleStartAt || null),
                    sale_start_at: alwaysOnSale ? null : (saleStartAt || null),
                    saleEndAt: alwaysOnSale ? null : (saleEndAt || null),
                    sale_end_at: alwaysOnSale ? null : (saleEndAt || null),

                    sortOrder: safeNum(sortOrder),
                    sort_order: safeNum(sortOrder),

                    qtyType: safeNum(qtyType),
                    qty_type: safeNum(qtyType),
                    qty: safeNum(qty),
                    limitQty: safeNum(limitQty),
                    limit_qty: safeNum(limitQty),

                    image1: image1.trim() ? toStoredPath(image1.trim()) : "",
                    image2: image2.trim() ? toStoredPath(image2.trim()) : "",
                    image3: image3.trim() ? toStoredPath(image3.trim()) : "",

                    otherImages: textToList(otherImagesText).map(toStoredPath),
                    other_image: textToList(otherImagesText).map(toStoredPath),
                    detailImages: textToList(detailImagesText).map(toStoredPath),
                    detail_image: textToList(detailImagesText).map(toStoredPath),

                    detail,
                    shortDescription: detail,
                    explains,
                    description: explains,

                    detailImageOnly,
                    detail_image_only: detailImageOnly ? 1 : 0,
                    detailImageType: safeNum(detailImageType),
                    detail_image_type: safeNum(detailImageType),

                    optionUse,
                    option_use: optionUse ? 1 : 0,
                    optionInfo: serializedOptionInfo,
                    option_info: serializedOptionInfo,

                    goodsCode: goodsCode.trim(),
                    goods_code: goodsCode.trim(),
                    brand: brand.trim(),
                    make: make.trim(),
                    origin: origin.trim(),
                    model: model.trim(),

                    cate: cateNumber,
                    categoryKeys,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.ok === false) {
                throw new Error(data?.message || `HTTP ${res.status}`);
            }

            alert("상품 수정이 완료되었습니다.");
            window.location.href = "/admin/products";
        } catch (e: any) {
            setErr(String(e?.message ?? e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div className="text-base font-extrabold text-[var(--dad-ink)]">상품 수정</div>
                <button
                    type="button"
                    onClick={save}
                    disabled={loading}
                    className="dad-btn dad-btn-primary h-10 px-4 text-sm disabled:opacity-60"
                >
                    {loading ? "저장 중..." : "저장"}
                </button>
            </div>

            {err ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {err}
                </div>
            ) : null}

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                    <label className="text-xs font-extrabold text-[var(--dad-muted)]">지점</label>
                    <select
                        className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                        value={tenantSlug}
                        onChange={(e) => setTenantSlug(e.target.value)}
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
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        {PRODUCT_STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    <div className="mt-1 text-[11px] font-bold text-[var(--dad-muted)]">
                        현재: {statusLabel(status)}
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <label className="text-xs font-extrabold text-[var(--dad-muted)]">카테고리</label>
                    <select
                        className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white px-3 py-3 text-sm font-bold"
                        value={cateCode}
                        onChange={(e) => setCateCode(e.target.value)}
                    >
                        <option value="0">선택 안함</option>
                        {PRODUCT_ADMIN_CATEGORY_OPTIONS.map((item) => (
                            <option key={item.code} value={item.code}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="lg:col-span-2">
                    <label className="text-xs font-extrabold text-[var(--dad-muted)]">상품명</label>
                    <input
                        className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>
            </section>

            <section className="dad-card space-y-5 p-5">
                <div className="text-base font-extrabold text-[var(--dad-ink)]">기본 정보</div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <SettingToggleCard
                        title="항시 판매"
                        description="판매 기간 제한 없이 상시 판매합니다. 켜면 날짜 설정이 무시됩니다."
                        checked={alwaysOnSale}
                        onChange={(v) => {
                            setAlwaysOnSale(v);
                            if (v) {
                                setSaleStartAt("");
                                setSaleEndAt("");
                            }
                        }}
                    />
                    <SettingToggleCard
                        title="픽업 전용"
                        description="배송 없이 매장 픽업 주문만 받습니다."
                        checked={pickupOnly}
                        onChange={setPickupOnly}
                    />
                    <SettingToggleCard
                        title="진열함"
                        description="유저 상품 목록과 홈 화면에 노출합니다."
                        checked={displayUse}
                        onChange={setDisplayUse}
                    />
                    <SettingToggleCard
                        title="판매함"
                        description="실제 주문 가능한 상태로 처리합니다."
                        checked={saleUse}
                        onChange={setSaleUse}
                    />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {baseFieldRows.map((item) => (
                        <div key={item.key}>
                            <label className="text-xs font-extrabold text-[var(--dad-muted)]">{item.label}</label>
                            <input
                                className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                                value={item.value}
                                onChange={(e) => item.setter(e.target.value)}
                            />
                        </div>
                    ))}
                </div>

                <div>
                    <label className="text-xs font-extrabold text-[var(--dad-muted)]">간략설명(detail)</label>
                    <textarea
                        className="mt-2 min-h-[90px] w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-semibold"
                        value={detail}
                        onChange={(e) => setDetail(e.target.value)}
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
                            value={price}
                            onChange={(e) => setPrice(safeNum(e.target.value))}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">공급가</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={origPrice}
                            onChange={(e) => setOrigPrice(safeNum(e.target.value))}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">소비자가</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={consumerPrice}
                            onChange={(e) => setConsumerPrice(safeNum(e.target.value))}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">최소구매수량</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={minQty}
                            onChange={(e) => setMinQty(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">최대구매수량</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={maxQty}
                            onChange={(e) => setMaxQty(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">재고 타입</label>
                        <select
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={qtyType}
                            onChange={(e) => setQtyType(e.target.value as "0" | "1")}
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
                            value={qty}
                            onChange={(e) => setQty(e.target.value)}
                            disabled={qtyType === "1"}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">구매제한수량</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={limitQty}
                            onChange={(e) => setLimitQty(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">
                            판매 시작일시
                            {alwaysOnSale && (
                                <span className="ml-2 text-[10px] font-bold text-[var(--dad-orange)]">항시 판매 중</span>
                            )}
                        </label>
                        <input
                            type="datetime-local"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold disabled:opacity-40"
                            value={saleStartAt}
                            onChange={(e) => setSaleStartAt(e.target.value)}
                            disabled={alwaysOnSale}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">
                            판매 종료일시
                            {alwaysOnSale && (
                                <span className="ml-2 text-[10px] font-bold text-[var(--dad-orange)]">항시 판매 중</span>
                            )}
                        </label>
                        <input
                            type="datetime-local"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold disabled:opacity-40"
                            value={saleEndAt}
                            onChange={(e) => setSaleEndAt(e.target.value)}
                            disabled={alwaysOnSale}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">정렬 우선순위</label>
                        <input
                            type="number"
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
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
                                checked={optionUse}
                                onChange={(e) => setOptionUse(e.target.checked)}
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

                {!optionUse ? (
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
                                            <input
                                                className="h-11 rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold"
                                                value={value.valueName}
                                                onChange={(e) =>
                                                    updateOptionValue(group.id, value.id, {
                                                        valueName: e.target.value,
                                                    })
                                                }
                                                placeholder="옵션값"
                                            />
                                            <input
                                                type="number"
                                                className="h-11 rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold"
                                                value={value.addPrice}
                                                onChange={(e) =>
                                                    updateOptionValue(group.id, value.id, {
                                                        addPrice: e.target.value,
                                                    })
                                                }
                                                placeholder="추가금액"
                                            />
                                            <input
                                                type="number"
                                                className="h-11 rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm font-bold"
                                                value={value.stockQty}
                                                onChange={(e) =>
                                                    updateOptionValue(group.id, value.id, {
                                                        stockQty: e.target.value,
                                                    })
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
                        { key: "image1", label: "대표이미지(image1)", value: image1, setter: setImage1, preview: preview1 },
                        { key: "image2", label: "목록이미지(image2)", value: image2, setter: setImage2, preview: preview2 },
                        { key: "image3", label: "작은목록이미지(image3)", value: image3, setter: setImage3, preview: preview3 },
                    ].map((item) => (
                        <div key={item.key} className="space-y-2">
                            <label className="text-xs font-extrabold text-[var(--dad-muted)]">{item.label}</label>
                            <input
                                className="w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                                value={item.value}
                                onChange={(e) => item.setter(e.target.value)}
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
                                            uploadSingleImage(item.setter, item.key, file);
                                            e.currentTarget.value = "";
                                        }}
                                    />
                                </label>

                                <button
                                    type="button"
                                    className="rounded-xl border border-[var(--dad-border)] bg-white px-3 py-2 text-xs font-extrabold text-red-600 disabled:opacity-40"
                                    disabled={!item.value}
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
                            value={otherImagesText}
                            onChange={(e) => setOtherImagesText(e.target.value)}
                        />
                        <label className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-xl border border-[var(--dad-border)] bg-white px-3 py-2 text-xs font-extrabold">
                            {uploadingKey === "other" ? "업로드 중..." : "추가이미지 여러장 업로드"}
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                    const files = e.target.files;
                                    if (!files?.length) return;
                                    appendImageToList("other", files);
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
                                            onClick={() => removeListImage("other", path)}
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
                            value={detailImagesText}
                            onChange={(e) => setDetailImagesText(e.target.value)}
                        />
                        <label className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-xl border border-[var(--dad-border)] bg-white px-3 py-2 text-xs font-extrabold">
                            {uploadingKey === "detail" ? "업로드 중..." : "상세이미지 여러장 업로드"}
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                    const files = e.target.files;
                                    if (!files?.length) return;
                                    appendImageToList("detail", files);
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
                                            onClick={() => removeListImage("detail", path)}
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
                            checked={detailImageOnly}
                            onChange={(e) => setDetailImageOnly(e.target.checked)}
                        />
                        상세설명을 이미지로만 사용
                    </label>

                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">상세이미지 출력방식</label>
                        <select
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={detailImageType}
                            onChange={(e) => setDetailImageType(e.target.value as "1" | "2")}
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
                    value={explains}
                    onChange={setExplains}
                    height={360}
                />
            </section>

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={save}
                    disabled={loading}
                    className="dad-btn dad-btn-primary h-12 px-5 text-sm disabled:opacity-60"
                >
                    {loading ? "저장 중..." : "저장"}
                </button>
            </div>
        </div>
    );
}