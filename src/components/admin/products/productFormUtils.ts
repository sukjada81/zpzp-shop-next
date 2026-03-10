// src/components/admin/products/productFormUtils.ts
export type OptionValueRow = {
    id: string;
    valueName: string;
    addPrice: string;
    stockQty: string;
};

export type OptionGroupRow = {
    id: string;
    groupName: string;
    values: OptionValueRow[];
};

export const PRODUCT_ADMIN_CATEGORY_OPTIONS = [
    { key: "daily-deal", label: "오늘의공구" },
    { key: "pickup-ready", label: "바로픽업가능" },
] as const;

const MAX_UPLOAD_FILE_SIZE_MB = 30;
const MAX_UPLOAD_FILE_SIZE = MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024;

function toProxyUploadPath(pathname: string) {
    const clean = pathname.replace(/^\/+/, "");
    return `/api/proxy/${clean}`;
}

export function toPreviewUrl(input: string) {
    const v = (input || "").trim();
    if (!v) return "";

    if (/^https?:\/\//i.test(v)) return v;
    if (/^\/\//.test(v)) return `https:${v}`;

    const normalized = v.startsWith("/") ? v : `/${v}`;

    // 업로드 파일은 항상 API 프록시를 통해 표시
    if (normalized.startsWith("/uploads/")) {
        return toProxyUploadPath(normalized);
    }

    return normalized;
}

export function toStoredPath(input: string) {
    const v = (input || "").trim();
    if (!v) return "";

    // 이미 상대경로면 그대로 저장
    if (!/^https?:\/\//i.test(v)) {
        return v.replace(/^\/+/, "");
    }

    try {
        const u = new URL(v);

        // uploads 경로인 경우에만 상대경로로 저장
        if (u.pathname.startsWith("/uploads/")) {
            return `${u.pathname}${u.search || ""}`.replace(/^\/+/, "");
        }

        // 외부 호스팅 이미지는 절대 URL 그대로 저장
        return v;
    } catch {
        return v;
    }
}

export function safeNum(n: any, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
}

function uid() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeValueRow(): OptionValueRow {
    return {
        id: uid(),
        valueName: "",
        addPrice: "0",
        stockQty: "",
    };
}

export function makeGroupRow(): OptionGroupRow {
    return {
        id: uid(),
        groupName: "",
        values: [makeValueRow()],
    };
}

export function parseOptionInfo(optionInfo: string | null | undefined): OptionGroupRow[] {
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
            id: uid(),
            groupName,
            values: rawValues.length
                ? rawValues.map((value) => {
                    const seg = value.split("^").map((x) => x.trim());
                    return {
                        id: uid(),
                        valueName: String(seg[0] ?? ""),
                        addPrice: String(seg[1] ?? "0"),
                        stockQty: String(seg[2] ?? ""),
                    };
                })
                : [makeValueRow()],
        };
    });
}

export function serializeOptionGroups(groups: OptionGroupRow[]) {
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

export function listToText(list: string[] | null | undefined) {
    return Array.isArray(list) ? list.join("\n") : "";
}

export function textToList(text: string) {
    return String(text || "")
        .split(/\r?\n|,/g)
        .map((x) => x.trim())
        .filter(Boolean);
}

export function insertAtCursor(
    textarea: HTMLTextAreaElement | null,
    value: string,
    insertion: string
) {
    if (!textarea) return value + insertion;

    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    return value.slice(0, start) + insertion + value.slice(end);
}

export async function uploadProductImage(file: File) {
    if (file.size > MAX_UPLOAD_FILE_SIZE) {
        throw new Error(`이미지 용량이 너무 큽니다. ${MAX_UPLOAD_FILE_SIZE_MB}MB 이하 파일만 업로드할 수 있습니다.`);
    }

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/proxy/admin/uploads/product-image", {
        method: "POST",
        body: formData,
        credentials: "include",
        cache: "no-store",
    });

    if (res.status === 413) {
        throw new Error(`이미지 용량이 너무 큽니다. ${MAX_UPLOAD_FILE_SIZE_MB}MB 이하로 업로드해주세요.`);
    }

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json?.ok === false || !json?.path) {
        throw new Error(json?.message || `이미지 업로드 실패 (HTTP ${res.status})`);
    }

    return String(json.path);
}