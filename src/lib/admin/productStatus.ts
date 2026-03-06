// src/lib/admin/productStatus.ts

export type ProductStatus = "draft" | "active" | "inactive" | "soldout" | "hidden";

export const PRODUCT_STATUS_OPTIONS: Array<{ value: ProductStatus; label: string; desc?: string }> = [
    { value: "draft", label: "임시저장", desc: "관리자만 보이며 판매/진열되지 않음" },
    { value: "active", label: "판매중", desc: "진열/판매 가능한 상태" },
    { value: "inactive", label: "판매중지", desc: "판매 불가(노출은 정책에 따라)" },
    { value: "soldout", label: "품절", desc: "재고/옵션 품절 상태(임시)" },
    { value: "hidden", label: "숨김", desc: "노출 숨김(관리자만)" },
];

export function statusLabel(status?: string | null) {
    const s = String(status ?? "").toLowerCase() as ProductStatus;
    return PRODUCT_STATUS_OPTIONS.find((x) => x.value === s)?.label ?? (status || "미정");
}

/**
 * ✅ legacy(mallRN_goods)에서는 display_use/sale_use도 있으니
 * status + display_use + sale_use 조합으로 실제 상태를 보여주고 싶으면 여기서 확장 가능합니다.
 */
export function normalizeStatus(input?: string | null): ProductStatus {
    const s = String(input ?? "").toLowerCase();
    if (s === "draft") return "draft";
    if (s === "active") return "active";
    if (s === "inactive") return "inactive";
    if (s === "soldout") return "soldout";
    if (s === "hidden") return "hidden";
    return "draft";
}