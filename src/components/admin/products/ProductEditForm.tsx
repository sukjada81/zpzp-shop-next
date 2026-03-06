"use client";

// src/components/admin/products/ProductEditForm.tsx
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PRODUCT_STATUS_OPTIONS, statusLabel } from "@/lib/admin/productStatus";

type OptionRow = {
    id?: string | number;
    name: string;
    sku?: string | null;
    price?: number;
    stockQty?: number | null;
    isActive?: boolean;
    sortOrder?: number;
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

export default function ProductEditForm({ product }: { product: any }) {
    const router = useRouter();

    const productId = useMemo(() => String(product?.id ?? ""), [product?.id]);

    const [title, setTitle] = useState<string>(product?.title ?? "");
    const [description, setDescription] = useState<string>(product?.description ?? "");
    const [status, setStatus] = useState<string>(product?.status ?? "draft");
    const [basePrice, setBasePrice] = useState<number>(Number(product?.basePrice ?? 0));
    const [pickupOnly, setPickupOnly] = useState<boolean>(Boolean(product?.pickupOnly ?? true));
    const [minQty, setMinQty] = useState<string>(product?.minQty == null ? "" : String(product.minQty));
    const [maxQty, setMaxQty] = useState<string>(product?.maxQty == null ? "" : String(product.maxQty));

    // ✅ 상대경로/절대URL 모두 허용
    const [thumbnailUrl, setThumbnailUrl] = useState<string>(product?.thumbnailUrl ?? "");
    const [imagesJson, setImagesJson] = useState<string>(product?.imagesJson ?? "");

    const [options, setOptions] = useState<OptionRow[]>(Array.isArray(product?.options) ? product.options : []);

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [okMsg, setOkMsg] = useState<string | null>(null);

    const thumbPreview = useMemo(() => {
        const v = (thumbnailUrl || "").trim();
        if (!v) return "";
        return toPreviewUrl(v);
    }, [thumbnailUrl]);

    const addOption = () => {
        setOptions((prev) => [
            ...prev,
            { name: "", sku: null, price: 0, stockQty: null, isActive: true, sortOrder: prev.length },
        ]);
    };

    const updateOption = (idx: number, patch: Partial<OptionRow>) => {
        setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
    };

    const removeOption = (idx: number) => {
        setOptions((prev) => prev.filter((_, i) => i !== idx));
    };

    const save = async () => {
        setErr(null);
        setOkMsg(null);

        if (!productId || !/^\d+$/.test(productId)) {
            setErr("상품 ID가 올바르지 않습니다.");
            return;
        }
        if (!title.trim()) {
            setErr("상품명(title)을 입력해주세요.");
            return;
        }

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

                    // ✅ 저장값 정규화 (assetOrigin과 같으면 상대경로)
                    thumbnailUrl: thumbnailUrl.trim() ? toStoredPath(thumbnailUrl.trim()) : null,

                    imagesJson: imagesJson.trim() || null,

                    // 옵션은 서버 update 로직이 준비되어 있을 때만 의미있음
                    options,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = (data as any)?.message || `HTTP ${res.status}`;
                throw new Error(msg);
            }

            setOkMsg("수정 완료");
            router.refresh();
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

            {(err || okMsg) && (
                <div className="rounded-2xl border border-[var(--dad-border)] bg-white/70 p-3 text-xs">
                    {err ? (
                        <>
                            <div className="font-extrabold text-[var(--dad-ink)]">저장 실패</div>
                            <div className="mt-1 text-[var(--dad-muted)]">{err}</div>
                        </>
                    ) : (
                        <>
                            <div className="font-extrabold text-[var(--dad-ink)]">완료</div>
                            <div className="mt-1 text-[var(--dad-muted)]">{okMsg}</div>
                        </>
                    )}
                </div>
            )}

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

                <label className="block sm:col-span-2">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">썸네일 URL/경로</div>
                    <input
                        className="h-12 w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 text-sm font-bold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                        value={thumbnailUrl}
                        onChange={(e) => setThumbnailUrl(e.target.value)}
                        placeholder='예: image/goods/img2/1/10002.jpg 또는 https://discountallday.kr/image/...'
                    />
                    <div className="mt-1 text-[11px] font-bold text-[var(--dad-muted)]">
                        상대경로를 넣어도 미리보기는 {getAssetOrigin()} 기준으로 보여줍니다.
                    </div>
                </label>

                {thumbPreview ? (
                    <div className="sm:col-span-2 rounded-2xl border border-[var(--dad-border)] overflow-hidden bg-white/70">
                        <div className="px-4 py-3 text-xs font-extrabold text-[var(--dad-muted)]">썸네일 미리보기</div>
                        <div className="aspect-[4/3] bg-[color:var(--dad-surface)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={thumbPreview} alt="thumbnail preview" className="h-full w-full object-cover" />
                        </div>
                    </div>
                ) : null}

                <label className="block sm:col-span-2">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">추가 이미지 JSON(선택)</div>
                    <textarea
                        className="min-h-[96px] w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                        value={imagesJson}
                        onChange={(e) => setImagesJson(e.target.value)}
                        placeholder='["https://...","https://..."]'
                    />
                </label>

                <label className="block sm:col-span-2">
                    <div className="mb-1 text-xs font-extrabold text-[var(--dad-muted)]">설명</div>
                    <textarea
                        className="min-h-[140px] w-full rounded-2xl border border-[var(--dad-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--dad-ink)] outline-none focus:ring-2 focus:ring-[var(--dad-orange)]"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="상품 설명을 입력하세요"
                    />
                </label>
            </div>

            {/* 옵션 (현재 구조 유지: rows 형태) */}
            <div className="rounded-2xl border border-[var(--dad-border)] bg-white/70 p-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-extrabold text-[var(--dad-ink)]">옵션</div>
                    <button type="button" onClick={addOption} className="dad-btn dad-btn-ghost h-9 px-3 text-sm">
                        + 옵션 추가
                    </button>
                </div>

                <div className="mt-3 space-y-2">
                    {options.length === 0 ? (
                        <div className="text-xs text-[var(--dad-muted)]">옵션이 없습니다.</div>
                    ) : (
                        options.map((o, idx) => (
                            <div
                                key={idx}
                                className="grid grid-cols-1 gap-2 rounded-2xl border border-[var(--dad-border)] bg-white p-3 sm:grid-cols-12"
                            >
                                <input
                                    className="sm:col-span-5 h-10 rounded-xl border border-[var(--dad-border)] px-3 text-sm font-bold outline-none"
                                    value={o.name ?? ""}
                                    onChange={(e) => updateOption(idx, { name: e.target.value })}
                                    placeholder="옵션명"
                                />
                                <input
                                    className="sm:col-span-3 h-10 rounded-xl border border-[var(--dad-border)] px-3 text-sm font-semibold outline-none"
                                    value={o.sku ?? ""}
                                    onChange={(e) => updateOption(idx, { sku: e.target.value })}
                                    placeholder="SKU(선택)"
                                />
                                <input
                                    className="sm:col-span-2 h-10 rounded-xl border border-[var(--dad-border)] px-3 text-sm font-semibold outline-none"
                                    value={String(o.price ?? 0)}
                                    onChange={(e) => updateOption(idx, { price: Number(e.target.value) })}
                                    inputMode="numeric"
                                    placeholder="가격"
                                />
                                <button
                                    type="button"
                                    className="sm:col-span-2 h-10 rounded-xl border border-[var(--dad-border)] text-sm font-bold hover:bg-[var(--dad-cream)]"
                                    onClick={() => removeOption(idx)}
                                >
                                    삭제
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

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