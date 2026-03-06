"use client";

import { useMemo, useState } from "react";
import { PRODUCT_STATUS_OPTIONS, statusLabel } from "@/lib/admin/productStatus";

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

function toStoredPath(input: string) {
    const v = (input || "").trim();
    if (!v) return "";
    if (!/^https?:\/\//i.test(v)) return v.replace(/^\/+/, "");

    try {
        const u = new URL(v);
        const asset = new URL(getAssetOrigin());
        if (u.origin === asset.origin) {
            return `${u.pathname}${u.search || ""}`.replace(/^\/+/, "");
        }
        return v;
    } catch {
        return v;
    }
}

function safeNum(n: any, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
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

function parseOptionInfo(optionInfo: string | null | undefined): OptionGroupRow[] {
    const text = String(optionInfo ?? "").trim();
    if (!text) return [];

    const groups = text
        .split("|*|")
        .map((g) => g.trim())
        .filter(Boolean);

    return groups.map((group) => {
        const parts = group.split("|");
        const groupName = String(parts[0] ?? "").trim();
        const rawValues = String(parts.slice(1).join("|") ?? "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);

        return {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            groupName,
            values: rawValues.length
                ? rawValues.map((value) => {
                    const seg = value.split("^").map((x) => x.trim());
                    return {
                        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                        valueName: String(seg[0] ?? ""),
                        addPrice: String(seg[1] ?? "0"),
                        stockQty: String(seg[2] ?? ""),
                    };
                })
                : [makeValueRow()],
        };
    });
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

export default function ProductEditForm({ product }: { product: any }) {
    const productId = useMemo(() => String(product?.id ?? ""), [product?.id]);

    const [title, setTitle] = useState<string>(product?.title ?? "");
    const [description, setDescription] = useState<string>(product?.description ?? "");
    const [status, setStatus] = useState<string>(product?.status ?? "draft");
    const [basePrice, setBasePrice] = useState<number>(Number(product?.basePrice ?? 0));
    const [pickupOnly, setPickupOnly] = useState<boolean>(Boolean(product?.pickupOnly ?? true));
    const [minQty, setMinQty] = useState<string>(product?.minQty == null ? "" : String(product.minQty));
    const [maxQty, setMaxQty] = useState<string>(product?.maxQty == null ? "" : String(product.maxQty));

    const [image1, setImage1] = useState<string>(product?.image1 ?? product?.thumbnailUrl ?? "");
    const [image2, setImage2] = useState<string>(product?.image2 ?? "");
    const [image3, setImage3] = useState<string>(product?.image3 ?? "");

    const [imagesJson, setImagesJson] = useState<string>(product?.imagesJson ?? "");
    const [uploadingKey, setUploadingKey] = useState<"image1" | "image2" | "image3" | null>(null);
    const [optionUse, setOptionUse] = useState<boolean>(Boolean(product?.optionUse ?? false));
    const [optionGroups, setOptionGroups] = useState<OptionGroupRow[]>(() =>
        parseOptionInfo(product?.optionInfo ?? "")
    );

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const preview1 = useMemo(() => toPreviewUrl(image1), [image1]);
    const preview2 = useMemo(() => toPreviewUrl(image2), [image2]);
    const preview3 = useMemo(() => toPreviewUrl(image3), [image3]);

    function addOptionGroup() {
        setOptionGroups((prev) => [...prev, makeGroupRow()]);
        if (!optionUse) setOptionUse(true);
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

            const next = String(json.path);
            if (key === "image1") setImage1(next);
            if (key === "image2") setImage2(next);
            if (key === "image3") setImage3(next);
        } finally {
            setUploadingKey(null);
        }
    }

    const save = async () => {
        setErr(null);

        if (!productId || !/^\d+$/.test(productId)) {
            setErr("상품 ID가 올바르지 않습니다.");
            return;
        }
        if (!title.trim()) {
            setErr("상품명(title)을 입력해주세요.");
            return;
        }

        const serializedOptionInfo = optionUse ? serializeOptionGroups(optionGroups) : "";

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
                    title: title.trim(),
                    description: description ?? "",
                    status,
                    basePrice: Number.isFinite(basePrice) ? basePrice : 0,
                    pickupOnly: Boolean(pickupOnly),
                    minQty: minQty === "" ? null : Number(minQty),
                    maxQty: maxQty === "" ? null : Number(maxQty),

                    image1: image1.trim() ? toStoredPath(image1.trim()) : "",
                    image2: image2.trim() ? toStoredPath(image2.trim()) : "",
                    image3: image3.trim() ? toStoredPath(image3.trim()) : "",

                    imagesJson: imagesJson.trim() || null,

                    optionUse,
                    option_use: optionUse ? 1 : 0,
                    optionInfo: serializedOptionInfo,
                    option_info: serializedOptionInfo,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.ok === false) {
                const msg = data?.message || `HTTP ${res.status}`;
                throw new Error(msg);
            }

            alert("상품 수정이 완료되었습니다.");
            window.location.href = "/admin/products";
        } catch (e: any) {
            setErr(String(e?.message ?? e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold text-[var(--dad-ink)]">기본 정보</div>
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
                <div className="rounded-2xl border border-[var(--dad-border)] bg-white/70 p-3 text-xs">
                    <div className="font-extrabold text-[var(--dad-ink)]">저장 실패</div>
                    <div className="mt-1 text-[var(--dad-muted)]">{err}</div>
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">상품명</div>
                    <input
                        className="h-12 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="상품명을 입력하세요"
                    />
                </label>

                <label className="block">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">상태</div>
                    <select
                        className="h-12 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
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
                </label>

                <label className="block">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">기본가</div>
                    <input
                        className="h-12 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                        value={String(basePrice)}
                        onChange={(e) => setBasePrice(Number(e.target.value))}
                        inputMode="numeric"
                        placeholder="0"
                    />
                </label>

                <label className="block">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">최소수량</div>
                    <input
                        className="h-12 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                        value={minQty}
                        onChange={(e) => setMinQty(e.target.value)}
                        inputMode="numeric"
                        placeholder="(선택)"
                    />
                </label>

                <label className="block">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">최대수량</div>
                    <input
                        className="h-12 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                        value={maxQty}
                        onChange={(e) => setMaxQty(e.target.value)}
                        inputMode="numeric"
                        placeholder="(선택)"
                    />
                </label>

                <label className="flex items-center gap-2 sm:col-span-2">
                    <input
                        type="checkbox"
                        checked={pickupOnly}
                        onChange={(e) => setPickupOnly(e.target.checked)}
                    />
                    <span className="text-sm font-bold text-[var(--dad-ink)]">픽업 전용</span>
                </label>

                {[
                    {
                        key: "image1" as const,
                        label: "대표이미지(image1)",
                        value: image1,
                        preview: preview1,
                        setter: setImage1,
                    },
                    {
                        key: "image2" as const,
                        label: "목록이미지(image2)",
                        value: image2,
                        preview: preview2,
                        setter: setImage2,
                    },
                    {
                        key: "image3" as const,
                        label: "작은목록이미지(image3)",
                        value: image3,
                        preview: preview3,
                        setter: setImage3,
                    },
                ].map((item) => (
                    <div key={item.key} className={item.key === "image3" ? "block sm:col-span-2" : "block"}>
                        <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">{item.label}</div>
                        <input
                            className="h-12 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                            value={item.value}
                            onChange={(e) => item.setter(e.target.value)}
                            placeholder="예: uploads/products/... 또는 https://..."
                        />
                        <div className="mt-2 flex items-center gap-2">
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
                        </div>
                    </div>
                ))}

                {[preview1, preview2, preview3].map((src, idx) => (
                    <div
                        key={idx}
                        className="rounded-2xl border border-[var(--dad-border)] overflow-hidden bg-white/70"
                    >
                        <div className="px-4 py-3 text-xs font-extrabold text-[var(--dad-muted)]">
                            {idx === 0 ? "image1 미리보기" : idx === 1 ? "image2 미리보기" : "image3 미리보기"}
                        </div>
                        <div className="aspect-[4/3] bg-[color:var(--dad-surface)]">
                            {src ? (
                                <img src={src} alt={`thumbnail-preview-${idx + 1}`} className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full items-center justify-center text-xs font-bold text-[var(--dad-muted)]">
                                    이미지 없음
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                <label className="block sm:col-span-2">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">추가 이미지 JSON(선택)</div>
                    <textarea
                        className="min-h-[96px] w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                        value={imagesJson}
                        onChange={(e) => setImagesJson(e.target.value)}
                        placeholder='["https://...","https://..."]'
                    />
                </label>
            </div>

            <section className="dad-card p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-extrabold text-[var(--dad-ink)]">옵션</div>
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

            <label className="block">
                <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">설명</div>
                <textarea
                    className="min-h-[140px] w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="상품 설명을 입력하세요"
                />
            </label>

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