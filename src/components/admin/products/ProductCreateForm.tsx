"use client";

// src/components/admin/products/ProductCreateForm.tsx
import { useMemo, useState } from "react";
import { PRODUCT_STATUS_OPTIONS, statusLabel } from "@/lib/admin/productStatus";

type Tenant = { id: string | number; slug?: string; name?: string };

type Props = {
    tenants: Tenant[];
};

type FormState = {
    tenantSlug: string; // ✅ server 요구: tenantSlug
    status: string;

    title: string; // ✅ server 요구: title
    name: string; // (레거시/DB용) UI 호환용
    price: number; // 판매가
    origPrice: number; // 공급가
    consumerPrice: number; // 소비자가

    pickupOnly: boolean;
    displayUse: boolean;
    saleUse: boolean;

    // 썸네일 URL (레거시 image2 용)
    thumbnailUrl: string;

    explains: string; // HTML

    optionUse: boolean;
    optionInfo: string; // ✅ 간단 입력(기존 방식)

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

        thumbnailUrl: "",
        explains: "<p></p>",

        optionUse: false,
        optionInfo: "",

        minQty: "",
        maxQty: "",
    });

    // ✅ 파일 선택 시 미리보기(실제 업로드는 “추가 API”로 연결해야 함)
    const [thumbFile, setThumbFile] = useState<File | null>(null);
    const [thumbPreview, setThumbPreview] = useState<string>("");

    const thumbSrc = useMemo(() => {
        if (form.thumbnailUrl?.trim()) return form.thumbnailUrl.trim();
        if (thumbPreview) return thumbPreview;
        return "";
    }, [form.thumbnailUrl, thumbPreview]);

    function onChange<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((p) => ({ ...p, [key]: value }));
    }

    async function onPickFile(file: File | null) {
        setThumbFile(file);
        if (!file) {
            setThumbPreview("");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setThumbPreview(String(reader.result || ""));
        reader.readAsDataURL(file);
    }

    function normalizeTitleInput(v: string) {
        // title이 핵심 필드라, name과 동기화해서 UX 혼란 방지
        const t = (v ?? "").toString();
        return t;
    }

    async function submit() {
        // ✅ 최소 검증
        if (!form.tenantSlug?.trim()) return alert("지점을 선택해 주세요.(tenantSlug)");
        if (!form.title.trim()) return alert("상품명을 입력해 주세요.(title)");
        if (safeNum(form.price) <= 0) return alert("판매가를 입력해 주세요.");

        /**
         * ✅ 백엔드가 지금 요구하는 형태:
         * - tenantSlug (필수)
         * - title (필수)
         *
         * 그리고 구현이 과거 Product 모델/레거시(mallRN_goods) 혼재라서
         * basePrice/price, description/explains 등 다양한 키를 같이 보내도 안전합니다.
         */
        const payload: any = {
            tenantSlug: form.tenantSlug.trim(), // ✅ 필수
            status: String(form.status || "draft"),

            // ✅ 필수
            title: form.title.trim(),

            // (레거시 컬럼/화면 호환)
            name: form.name?.trim() || form.title.trim(),

            // 가격계열: 서버 구현이 basePrice만 쓰거나 price만 쓸 수 있어 둘 다 전송
            basePrice: safeNum(form.price),
            price: safeNum(form.price),
            orig_price: safeNum(form.origPrice),
            consumer_price: safeNum(form.consumerPrice),

            pickupOnly: !!form.pickupOnly,
            pickup_only: form.pickupOnly ? 1 : 0,

            displayUse: !!form.displayUse,
            display_use: form.displayUse ? 1 : 0,

            saleUse: !!form.saleUse,
            sale_use: form.saleUse ? 1 : 0,

            // 썸네일: 레거시 image2로도, 신형 thumbnailUrl로도 같이 전송
            thumbnailUrl: (form.thumbnailUrl || "").trim() || null,
            image2: (form.thumbnailUrl || "").trim(),

            // 설명: 신형 description + 레거시 explains 같이
            description: form.explains ?? "",
            explains: form.explains ?? "",

            optionUse: !!form.optionUse,
            option_use: form.optionUse ? 1 : 0,
            optionInfo: form.optionInfo ?? "",
            option_info: form.optionInfo ?? "",

            minQty: form.minQty ? safeNum(form.minQty) : null,
            maxQty: form.maxQty ? safeNum(form.maxQty) : null,
            min_qty: form.minQty ? safeNum(form.minQty) : null,
            max_qty: form.maxQty ? safeNum(form.maxQty) : null,
        };

        // ✅ 파일 업로드는 아직 “저장”이 아니라 “미리보기”만.
        // 서버에서 base64 업로드를 지원하도록 확장하면 같이 저장 가능.
        if (!payload.thumbnailUrl && thumbPreview) {
            payload.thumbnail_upload_base64 = thumbPreview;
            payload.thumbnail_upload_name = thumbFile?.name || "thumbnail.png";
        }

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

        const newId = String(json?.product?.id ?? json?.id ?? "");
        if (newId) {
            window.location.href = `/products/${newId}`;
            return;
        }
        window.location.href = `/products`;
    }

    return (
        <div className="space-y-6">
            {/* 기본정보 */}
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

            {/* 상품명/가격 */}
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
                            // name도 같이 동기화(레거시 대비)
                            if (!form.name || form.name === form.title) onChange("name", v);
                        }}
                        placeholder="예: 홍삼원골드 100ml x 24포"
                    />
                    <div className="mt-1 text-[11px] font-bold text-[var(--dad-muted)]">
                        서버 필수값: <span className="text-[var(--dad-ink)]">title</span>
                    </div>
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

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">
                            대표이미지(썸네일) URL (thumbnailUrl / image2)
                        </label>
                        <input
                            className="mt-2 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                            value={form.thumbnailUrl}
                            onChange={(e) => onChange("thumbnailUrl", e.target.value)}
                            placeholder='예: https://discountallday.kr/image/goods/img2/1/10002.jpg'
                        />
                        <div className="mt-1 text-[11px] font-bold text-[var(--dad-muted)]">
                            URL이 있으면 URL 우선 미리보기 / 없으면 파일 미리보기
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-extrabold text-[var(--dad-muted)]">또는 이미지 파일 선택(미리보기)</label>
                        <input
                            type="file"
                            accept="image/*"
                            className="mt-2 block w-full text-sm font-bold"
                            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                        />
                    </div>
                </div>

                {thumbSrc ? (
                    <div className="rounded-2xl border border-[var(--dad-border)] overflow-hidden bg-white/70">
                        <div className="px-4 py-3 text-xs font-extrabold text-[var(--dad-muted)]">미리보기</div>
                        <div className="aspect-[4/3] bg-[color:var(--dad-surface)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={thumbSrc} alt="thumbnail preview" className="h-full w-full object-cover" />
                        </div>
                    </div>
                ) : null}
            </section>

            {/* 옵션 (간단 입력 방식 유지) */}
            <section className="dad-card p-4 sm:p-5 space-y-3">
                <label className="inline-flex items-center gap-2 text-sm font-extrabold">
                    <input
                        type="checkbox"
                        checked={form.optionUse}
                        onChange={(e) => onChange("optionUse", e.target.checked)}
                    />
                    옵션 사용(option_use)
                </label>

                <div>
                    <label className="text-xs font-extrabold text-[var(--dad-muted)]">
                        옵션 정보(option_info) — 예: <span className="font-bold">수량|1개,2개,3개</span>
                    </label>
                    <textarea
                        className="mt-2 h-28 w-full rounded-xl border border-[var(--dad-border)] bg-white/70 px-3 py-3 text-sm font-bold"
                        value={form.optionInfo}
                        onChange={(e) => onChange("optionInfo", e.target.value)}
                        placeholder="수량|1개,2개,3개"
                        disabled={!form.optionUse}
                    />
                    <div className="mt-1 text-[11px] font-bold text-[var(--dad-muted)]">
                        (레거시) option_info 포맷 그대로 사용합니다.
                    </div>
                </div>

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

            {/* 상세설명 */}
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
                    <div className="prose prose-sm max-w-none mt-3" dangerouslySetInnerHTML={{ __html: form.explains || "" }} />
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