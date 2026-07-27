"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Download,
    HelpCircle,
    Package,
    Plus,
    RefreshCw,
    Save,
    Trash2,
} from "lucide-react";

const PAGE_SIZE = 5;
const MAX_FILTERED_ALL_RESULTS = 10_000;

type ProductItem = {
    id: string;
    name: string;
    category: string;
    price: number;
    stock: number;
    image: string;
    productStatus: string;
    slotCounted: boolean;
    selectedAt: string | null;
    displayStatus: "visible" | "hidden";
    displayOrder: number;
    canRegister: boolean;
    unavailableReason: string | null;
    salesCount: number;
    salesQuantity: number;
};

type ProductList = {
    items: ProductItem[];
    allIds: string[];
    total: number;
    page: number;
    pageSize: number;
};

type ResponseData = {
    ok: boolean;
    message?: string;
    linker?: { shopName: string; shopSlug: string };
    summary?: {
        grade: string;
        gradeTitle: string;
        gradeLookupType: 1 | 2;
        gradeYearMonth: string | null;
        commissionRate: number;
        slotLimit: number;
        slotUsed: number;
        slotRemaining: number;
        slotExceeded: number;
        selectedTotal: number;
        stoppedTotal: number;
        registrationBlocked: boolean;
    };
    selected?: ProductList;
    available?: ProductList;
};

type ToastMessage = {
    type: "register" | "delete" | "save" | "error";
    text: string;
};

type ConfirmDialog = {
    title: string;
    description: string;
    confirmLabel: string;
    tone: "blue" | "rose";
    action: () => void | Promise<void>;
};

const EMPTY_LIST: ProductList = {
    items: [],
    allIds: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
};

function money(value: number) {
    return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function dateText(value: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("ko-KR");
}

function csvDownload(filename: string, rows: Array<Array<string | number | boolean>>) {
    const csv = rows
        .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
        .join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function ProductImage({ item, size = "normal" }: { item: ProductItem; size?: "normal" | "large" }) {
    const sizeClass = size === "large" ? "h-16 w-16" : "h-12 w-12";
    return item.image ? (
        <img src={item.image} alt="" className={`${sizeClass} shrink-0 rounded-xl object-cover`} />
    ) : (
        <div className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-xl bg-slate-100`}>
            <Package className="h-5 w-5 text-slate-400" />
        </div>
    );
}

function Pager({
    page,
    total,
    pageSize,
    onChange,
}: {
    page: number;
    total: number;
    pageSize: number;
    onChange: (page: number) => void;
}) {
    const max = Math.max(1, Math.ceil(total / pageSize));
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    return (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm ring-1 ring-slate-200">
            <button
                type="button"
                disabled={page <= 1}
                onClick={() => onChange(page - 1)}
                className="rounded-xl border border-slate-200 p-2.5 disabled:opacity-30"
                aria-label="이전 페이지"
            >
                <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-32 text-center">
                <div className="font-bold text-slate-700">{from.toLocaleString("ko-KR")}–{to.toLocaleString("ko-KR")} / 총 {total.toLocaleString("ko-KR")}개</div>
                <div className="mt-0.5 text-xs text-slate-400">{page} / {max} 페이지</div>
            </div>
            <button
                type="button"
                disabled={page >= max}
                onClick={() => onChange(page + 1)}
                className="rounded-xl border border-slate-200 p-2.5 disabled:opacity-30"
                aria-label="다음 페이지"
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    );
}

export default function SellerProductsClient({ tenant }: { tenant: string }) {
    const [data, setData] = useState<ResponseData | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<ToastMessage | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
    const [selectedQ, setSelectedQ] = useState("");
    const [availableQ, setAvailableQ] = useState("");
    const [selectedPage, setSelectedPage] = useState(1);
    const [availablePage, setAvailablePage] = useState(1);
    const [checkedSelected, setCheckedSelected] = useState<Set<string>>(new Set());
    const [checkedAvailable, setCheckedAvailable] = useState<Set<string>>(new Set());
    const [orderDraft, setOrderDraft] = useState<Record<string, number>>({});
    const [visibilityDraft, setVisibilityDraft] = useState<Record<string, "visible" | "hidden">>({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                selectedQ,
                availableQ,
                selectedPage: String(selectedPage),
                availablePage: String(availablePage),
                pageSize: String(PAGE_SIZE),
            });
            const response = await fetch(`/api/seller/${encodeURIComponent(tenant)}/products?${params}`, {
                cache: "no-store",
                credentials: "include",
            });
            const payload = (await response.json().catch(() => null)) as ResponseData | null;
            if (!response.ok || !payload?.ok) {
                throw new Error(payload?.message || "상품 정보를 불러오지 못했습니다.");
            }
            setData(payload);
            setCheckedSelected(new Set());
            setCheckedAvailable(new Set());
            setOrderDraft(
                Object.fromEntries((payload.selected?.items || []).map((item) => [item.id, item.displayOrder]))
            );
            setVisibilityDraft(
                Object.fromEntries((payload.selected?.items || []).map((item) => [item.id, item.displayStatus]))
            );
        } catch (error) {
            setMessage({
                type: "error",
                text: error instanceof Error ? error.message : "상품 정보를 불러오지 못했습니다.",
            });
        } finally {
            setLoading(false);
        }
    }, [tenant, selectedQ, availableQ, selectedPage, availablePage]);

    useEffect(() => {
        const timer = window.setTimeout(load, 300);
        return () => window.clearTimeout(timer);
    }, [load]);

    useEffect(() => {
        if (!message) return;
        const timer = window.setTimeout(() => setMessage(null), 3000);
        return () => window.clearTimeout(timer);
    }, [message]);

    async function mutate(
        path: string,
        method: "POST" | "DELETE" | "PATCH",
        body: unknown,
        successText: string
    ) {
        setBusy(true);
        setMessage(null);
        try {
            const response = await fetch(`/api/seller/${encodeURIComponent(tenant)}/products/${path}`, {
                method,
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.ok) {
                throw new Error(payload?.message || "처리하지 못했습니다.");
            }
            const successType = method === "POST" ? "register" : method === "DELETE" ? "delete" : "save";
            setMessage({ type: successType, text: `${successText}: ${Number(payload.count || 0)}개` });
            await load();
        } catch (error) {
            setMessage({
                type: "error",
                text: error instanceof Error ? error.message : "처리하지 못했습니다.",
            });
        } finally {
            setBusy(false);
        }
    }

    const selected = data?.selected ?? EMPTY_LIST;
    const available = data?.available ?? EMPTY_LIST;
    const summary = data?.summary;
    const registrationBlocked = Boolean(summary?.registrationBlocked);
    const filteredAllTooLarge = available.total > MAX_FILTERED_ALL_RESULTS;
    const allSelectedOnPage =
        selected.items.length > 0 && selected.items.every((item) => checkedSelected.has(item.id));
    const allAvailableOnPage =
        available.items.length > 0 && available.items.every((item) => checkedAvailable.has(item.id));

    function toggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
        setter((before) => {
            const next = new Set(before);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function downloadSelected() {
        csvDownload(`링커_등록상품_현재페이지_${new Date().toISOString().slice(0, 10)}.csv`, [
            ["상품번호", "상품명", "카테고리", "판매가", "상품상태", "진열상태", "진열순서", "판매건수", "판매수량", "등록일"],
            ...selected.items.map((item) => [
                item.id,
                item.name,
                item.category,
                item.price,
                item.productStatus,
                item.displayStatus === "visible" ? "진열 중" : "숨김",
                item.displayOrder,
                item.salesCount,
                item.salesQuantity,
                dateText(item.selectedAt),
            ]),
        ]);
    }

    function downloadAvailable() {
        csvDownload(`링커_등록가능상품_현재페이지_${new Date().toISOString().slice(0, 10)}.csv`, [
            ["상품번호", "상품명", "카테고리", "판매가", "재고", "등록가능"],
            ...available.items.map((item) => [
                item.id,
                item.name,
                item.category,
                item.price,
                item.stock,
                item.canRegister ? "가능" : "불가",
            ]),
        ]);
    }

    const cardItems = useMemo(
        () =>
            summary
                ? [
                    ["현재 등급", summary.gradeTitle || summary.grade, "text-violet-600"],
                    ["등급 기준", summary.gradeLookupType === 2 ? "기본 재산정" : "최근 등급 유지", "text-slate-900"],
                    ["최대 슬롯", `${summary.slotLimit}개`, "text-slate-900"],
                    ["사용 슬롯", `${summary.slotUsed}개`, "text-blue-600"],
                    ["남은 슬롯", `${summary.slotRemaining}개`, summary.slotRemaining > 0 ? "text-emerald-600" : "text-red-600"],
                    ["판매 중지", `${summary.stoppedTotal}개`, "text-slate-500"],
                ]
                : [],
        [summary]
    );

    async function runConfirmedAction() {
        if (!confirmDialog) return;
        const action = confirmDialog.action;
        setConfirmDialog(null);
        await action();
    }

    function saveCurrentPageSettings() {
        return mutate(
            "order",
            "PATCH",
            {
                items: selected.items.map((item) => ({
                    productId: item.id,
                    displayOrder: orderDraft[item.id] ?? item.displayOrder,
                    displayStatus: visibilityDraft[item.id] ?? item.displayStatus,
                })),
            },
            "진열 상태·순서 저장 완료"
        );
    }

    function requestSaveCurrentPageSettings() {
        const orders = selected.items.map((item) => orderDraft[item.id] ?? item.displayOrder);
        const hasDuplicateOrder = new Set(orders).size !== orders.length;
        if (!hasDuplicateOrder) {
            void saveCurrentPageSettings();
            return;
        }
        setConfirmDialog({
            title: "동일한 진열 순서가 있습니다",
            description: "같은 순서 번호를 가진 상품은 보조 정렬 기준에 따라 표시 순서가 달라질 수 있습니다.\n입력한 순서로 계속 저장하시겠습니까?",
            confirmLabel: "계속 저장",
            tone: "blue",
            action: saveCurrentPageSettings,
        });
    }

    function requestRegisterAllFiltered() {
        if (filteredAllTooLarge) {
            setMessage({
                type: "error",
                text: `검색 결과가 ${MAX_FILTERED_ALL_RESULTS.toLocaleString("ko-KR")}개를 초과하여 전체 등록할 수 없습니다. 검색조건을 더 구체적으로 입력해 주세요.`,
            });
            return;
        }
        setConfirmDialog({
            title: "전체 검색 상품 등록",
            description: `현재 검색조건에 해당하는 ${available.total.toLocaleString("ko-KR")}개 상품을 모두 등록하시겠습니까?\n남은 슬롯보다 많으면 등록되지 않습니다.`,
            confirmLabel: "전체 등록",
            tone: "blue",
            action: () => mutate("select", "POST", { productIds: [], scope: "filtered_all", availableQ }, "상품 등록 완료"),
        });
    }

    return (
        <div className="space-y-5">
            {message ? (
                <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center p-4" aria-live="polite">
                    <div
                        role="status"
                        className={`w-full max-w-sm rounded-2xl border px-5 py-4 text-center text-sm font-bold shadow-[0_20px_60px_rgba(15,23,42,0.22)] sm:text-base ${
                            message.type === "register"
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : message.type === "delete"
                                  ? "border-rose-200 bg-rose-50 text-rose-700"
                                  : message.type === "save"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-amber-200 bg-amber-50 text-amber-800"
                        }`}
                    >
                        {message.text}
                    </div>
                </div>
            ) : null}

            {confirmDialog ? (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
                    <div role="dialog" aria-modal="true" aria-labelledby="product-confirm-title" className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.3)]">
                        <h2 id="product-confirm-title" className="text-center text-lg font-extrabold text-slate-900">{confirmDialog.title}</h2>
                        <p className="mt-3 whitespace-pre-line text-center text-sm leading-6 text-slate-600">{confirmDialog.description}</p>
                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <button type="button" onClick={() => setConfirmDialog(null)} disabled={busy} className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 disabled:opacity-40">취소</button>
                            <button type="button" onClick={runConfirmedAction} disabled={busy} className={`rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40 ${confirmDialog.tone === "rose" ? "bg-rose-600" : "bg-blue-600"}`}>{confirmDialog.confirmLabel}</button>
                        </div>
                    </div>
                </div>
            ) : null}

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-xl font-extrabold tracking-[-0.04em] text-slate-900 sm:text-2xl">
                            링커 상품 관리
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">상품은 검색 결과 기준으로 5개씩 표시합니다.</p>
                    </div>
                    <button
                        type="button"
                        onClick={load}
                        disabled={loading || busy}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold sm:w-auto"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        새로고침
                    </button>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {cardItems.map(([label, value, valueClass]) => (
                        <div key={label} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4">
                            <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                                <span>{label}</span>
                                {label === "남은 슬롯" ? (
                                    <span className="group relative inline-flex" tabIndex={0} aria-label="남은 슬롯 계산 안내">
                                        <HelpCircle className="h-4 w-4 cursor-help text-slate-400" />
                                        <span role="tooltip" className="pointer-events-none absolute left-1/2 top-6 z-30 hidden w-64 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium leading-5 text-white shadow-xl group-hover:block group-focus:block">
                                            판매 중지 상품은 사용 슬롯에 포함되지 않습니다. 따라서 판매 중지 상품 수만큼 새 상품을 추가할 수 있는 여유가 남은 슬롯에 반영됩니다.
                                        </span>
                                    </span>
                                ) : null}
                            </div>
                            <div className={`mt-2 text-lg font-extrabold sm:text-xl ${valueClass}`}>{value}</div>
                        </div>
                    ))}
                </div>
                {summary && summary.slotExceeded > 0 ? (
                    <div className="mt-4 flex gap-2 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <span>
                            현재 등급의 최대 슬롯을 {summary.slotExceeded}개 초과했습니다.
                            기존 진열 상품은 계속 판매됩니다. 슬롯을 정리해야 새 상품을 올릴 수 있어요.
                        </span>
                    </div>
                ) : null}
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-900">등록된 상품</h2>
                        <p className="mt-1 text-sm text-slate-500">총 {selected.total.toLocaleString("ko-KR")}개</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <button type="button" onClick={downloadSelected} disabled={selected.items.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold disabled:opacity-40">
                            <Download className="h-4 w-4" />현재 페이지 CSV
                        </button>
                        <button type="button" disabled={busy || checkedSelected.size === 0} onClick={() => setConfirmDialog({ title: "선택 상품 삭제", description: `선택한 ${checkedSelected.size}개 상품을 삭제하시겠습니까?\n기존 주문과 판매 이력은 유지됩니다.`, confirmLabel: "삭제", tone: "rose", action: () => mutate("select", "DELETE", { productIds: [...checkedSelected], scope: "selected" }, "상품 삭제 완료") })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                            <Trash2 className="h-4 w-4" />선택 상품 삭제
                        </button>
                        <button type="button" disabled={busy || selected.total === 0} onClick={() => setConfirmDialog({ title: "전체 검색 상품 삭제", description: `현재 검색조건에 해당하는 ${selected.total.toLocaleString("ko-KR")}개 상품을 모두 삭제하시겠습니까?\n기존 주문과 판매 이력은 유지됩니다.`, confirmLabel: "전체 삭제", tone: "rose", action: () => mutate("select", "DELETE", { productIds: [], scope: "filtered_all", selectedQ }, "상품 삭제 완료") })} className="rounded-xl border border-rose-200 px-3 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-40">
                            전체 검색 상품 삭제
                        </button>
                    </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input value={selectedQ} onChange={(event) => { setSelectedQ(event.target.value); setSelectedPage(1); }} placeholder="상품명 또는 상품번호 검색" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                    <button type="button" disabled={busy || selected.items.length === 0} onClick={requestSaveCurrentPageSettings} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
                        <Save className="h-4 w-4" />진열 상태·순서 저장
                    </button>
                </div>

                <div className="mt-4 hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[980px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">번호</th><th className="p-3"><input type="checkbox" checked={allSelectedOnPage} onChange={() => setCheckedSelected(allSelectedOnPage ? new Set() : new Set(selected.items.map((item) => item.id)))} /></th><th className="p-3">상품</th><th className="p-3">상태</th><th className="p-3">판매가</th><th className="p-3">판매 이력</th><th className="p-3">진열</th><th className="p-3">순서</th><th className="p-3">등록일</th><th className="p-3">관리</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {selected.items.map((item, index) => (
                                <tr key={item.id} className={!item.slotCounted ? "bg-amber-50/60" : ""}>
                                    <td className="p-3 text-center font-semibold text-slate-500">{(selected.page - 1) * selected.pageSize + index + 1}</td>
                                    <td className="p-3"><input type="checkbox" checked={checkedSelected.has(item.id)} onChange={() => toggle(setCheckedSelected, item.id)} /></td>
                                    <td className="p-3"><div className="flex items-center gap-3"><ProductImage item={item} /><div><div className="font-bold text-slate-900">{item.name}</div><div className="text-xs text-slate-400">#{item.id} · {item.category}</div></div></div></td>
                                    <td className="p-3">{item.productStatus}</td>
                                    <td className="p-3 font-semibold">{money(item.price)}</td>
                                    <td className="p-3 text-xs">{item.salesCount}건 / {item.salesQuantity}개</td>
                                    <td className="p-3"><select value={visibilityDraft[item.id] ?? item.displayStatus} onChange={(event) => setVisibilityDraft((before) => ({ ...before, [item.id]: event.target.value as "visible" | "hidden" }))} className="rounded-lg border border-slate-200 p-2"><option value="visible">진열 중</option><option value="hidden">숨김</option></select></td>
                                    <td className="p-3"><input type="number" min={1} value={orderDraft[item.id] ?? item.displayOrder} onChange={(event) => setOrderDraft((before) => ({ ...before, [item.id]: Number(event.target.value) }))} className="w-20 rounded-lg border border-slate-200 p-2" /></td>
                                    <td className="p-3 text-xs text-slate-500">{dateText(item.selectedAt)}</td>
                                    <td className="p-3"><button type="button" disabled={busy} onClick={() => setConfirmDialog({ title: "상품 삭제", description: `${item.name}\n상품을 삭제하시겠습니까?`, confirmLabel: "삭제", tone: "rose", action: () => mutate("select", "DELETE", { productIds: [item.id], scope: "single" }, "상품 삭제 완료") })} className="rounded-lg border border-rose-200 px-3 py-2 font-semibold text-rose-700">삭제</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 space-y-3 md:hidden">
                    {selected.items.map((item, index) => (
                        <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                            <div className="flex gap-3">
                                <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-600">{(selected.page - 1) * selected.pageSize + index + 1}</span>
                                <input type="checkbox" checked={checkedSelected.has(item.id)} onChange={() => toggle(setCheckedSelected, item.id)} className="mt-1 h-5 w-5 shrink-0" />
                                <ProductImage item={item} size="large" />
                                <div className="min-w-0 flex-1"><div className="line-clamp-2 font-bold text-slate-900">{item.name}</div><div className="mt-1 text-xs text-slate-400">#{item.id}</div><div className="mt-2 font-semibold">{money(item.price)}</div></div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <select value={visibilityDraft[item.id] ?? item.displayStatus} onChange={(event) => setVisibilityDraft((before) => ({ ...before, [item.id]: event.target.value as "visible" | "hidden" }))} className="rounded-xl border border-slate-200 p-3 text-sm"><option value="visible">진열 중</option><option value="hidden">숨김</option></select>
                                <input type="number" min={1} value={orderDraft[item.id] ?? item.displayOrder} onChange={(event) => setOrderDraft((before) => ({ ...before, [item.id]: Number(event.target.value) }))} className="min-w-0 rounded-xl border border-slate-200 p-3 text-sm" aria-label="진열 순서" />
                            </div>
                            <button type="button" disabled={busy} onClick={() => setConfirmDialog({ title: "상품 삭제", description: `${item.name}\n상품을 삭제하시겠습니까?`, confirmLabel: "삭제", tone: "rose", action: () => mutate("select", "DELETE", { productIds: [item.id], scope: "single" }, "상품 삭제 완료") })} className="mt-3 w-full rounded-xl border border-rose-200 py-3 text-sm font-semibold text-rose-700">삭제</button>
                        </article>
                    ))}
                </div>
                {!loading && selected.items.length === 0 ? <div className="py-12 text-center text-sm text-slate-500">등록된 상품이 없습니다.</div> : null}
                <Pager page={selected.page} total={selected.total} pageSize={selected.pageSize} onChange={setSelectedPage} />
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div><h2 className="text-xl font-extrabold text-slate-900">등록 가능한 상품</h2><p className="mt-1 text-sm text-slate-500">검색 결과 총 {available.total.toLocaleString("ko-KR")}개</p></div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <button type="button" onClick={downloadAvailable} disabled={available.items.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold disabled:opacity-40"><Download className="h-4 w-4" />현재 페이지 CSV</button>
                        <button type="button" disabled={busy || checkedAvailable.size === 0 || registrationBlocked} onClick={() => setConfirmDialog({ title: "선택 상품 등록", description: `선택한 ${checkedAvailable.size}개 상품을 등록하시겠습니까?`, confirmLabel: "등록", tone: "blue", action: () => mutate("select", "POST", { productIds: [...checkedAvailable], scope: "selected" }, "상품 등록 완료") })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" />선택 상품 등록</button>
                        <button type="button" aria-disabled={filteredAllTooLarge} disabled={busy || available.total === 0 || registrationBlocked} onClick={requestRegisterAllFiltered} className={`rounded-xl border border-blue-200 px-3 py-2.5 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 ${filteredAllTooLarge ? "cursor-not-allowed opacity-40" : ""}`}>전체 검색 상품 등록</button>
                    </div>
                </div>
                {registrationBlocked ? (
                    <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
                        {summary && summary.slotExceeded > 0
                            ? "슬롯을 정리해야 새 상품을 올릴 수 있어요."
                            : "사용 가능한 슬롯이 없어 새 상품을 등록할 수 없습니다."}
                    </p>
                ) : null}
                {filteredAllTooLarge ? (
                    <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
                        검색 결과가 10,000개를 초과하여 전체 등록할 수 없습니다. 검색조건을 더 구체적으로 입력해 주세요.
                    </p>
                ) : null}
                <input value={availableQ} onChange={(event) => { setAvailableQ(event.target.value); setAvailablePage(1); }} placeholder="전체 상품에서 상품명 또는 상품번호 검색" className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500" />

                <div className="mt-4 hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">번호</th><th className="p-3"><input type="checkbox" disabled={registrationBlocked} checked={!registrationBlocked && allAvailableOnPage} onChange={() => setCheckedAvailable(allAvailableOnPage ? new Set() : new Set(available.items.map((item) => item.id)))} className="disabled:cursor-not-allowed disabled:opacity-40" /></th><th className="p-3">상품</th><th className="p-3">상태</th><th className="p-3">판매가</th><th className="p-3">재고</th><th className="p-3">관리</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {available.items.map((item, index) => (
                                <tr key={item.id}>
                                    <td className="p-3 text-center font-semibold text-slate-500">{(available.page - 1) * available.pageSize + index + 1}</td>
                                    <td className="p-3"><input type="checkbox" disabled={registrationBlocked} checked={!registrationBlocked && checkedAvailable.has(item.id)} onChange={() => toggle(setCheckedAvailable, item.id)} className="disabled:cursor-not-allowed disabled:opacity-40" /></td>
                                    <td className="p-3"><div className="flex items-center gap-3"><ProductImage item={item} /><div><div className="font-bold text-slate-900">{item.name}</div><div className="text-xs text-slate-400">#{item.id} · {item.category}</div></div></div></td>
                                    <td className="p-3">{item.productStatus}</td>
                                    <td className="p-3 font-semibold">{money(item.price)}</td>
                                    <td className="p-3">{item.stock.toLocaleString("ko-KR")}개</td>
                                    <td className="p-3"><button type="button" disabled={busy || registrationBlocked} onClick={() => setConfirmDialog({ title: "상품 등록", description: `${item.name}\n상품을 등록하시겠습니까?`, confirmLabel: "등록", tone: "blue", action: () => mutate("select", "POST", { productIds: [item.id], scope: "single" }, "상품 등록 완료") })} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">등록</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 space-y-3 md:hidden">
                    {available.items.map((item, index) => (
                        <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                            <div className="flex gap-3">
                                <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-600">{(available.page - 1) * available.pageSize + index + 1}</span>
                                <input type="checkbox" disabled={registrationBlocked} checked={!registrationBlocked && checkedAvailable.has(item.id)} onChange={() => toggle(setCheckedAvailable, item.id)} className="mt-1 h-5 w-5 shrink-0 disabled:cursor-not-allowed disabled:opacity-40" />
                                <ProductImage item={item} size="large" />
                                <div className="min-w-0 flex-1"><div className="line-clamp-2 font-bold text-slate-900">{item.name}</div><div className="mt-1 text-xs text-slate-400">#{item.id} · {item.category}</div><div className="mt-2 font-semibold">{money(item.price)}</div><div className="mt-1 text-xs text-slate-500">재고 {item.stock.toLocaleString("ko-KR")}개</div></div>
                            </div>
                            <button type="button" disabled={busy || registrationBlocked} onClick={() => setConfirmDialog({ title: "상품 등록", description: `${item.name}\n상품을 등록하시겠습니까?`, confirmLabel: "등록", tone: "blue", action: () => mutate("select", "POST", { productIds: [item.id], scope: "single" }, "상품 등록 완료") })} className="mt-4 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">등록</button>
                        </article>
                    ))}
                </div>
                {!loading && available.items.length === 0 ? <div className="py-12 text-center text-sm text-slate-500">등록 가능한 상품이 없습니다.</div> : null}
                <Pager page={available.page} total={available.total} pageSize={available.pageSize} onChange={setAvailablePage} />
            </section>
        </div>
    );
}
