"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Download, Package, Plus, RefreshCw, Save, Trash2 } from "lucide-react";

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

const EMPTY_LIST: ProductList = { items: [], allIds: [], total: 0, page: 1, pageSize: 20 };

function money(value: number) {
    return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function dateText(value: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("ko-KR");
}

function csvDownload(filename: string, rows: Array<Array<string | number | boolean>>) {
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function Pager({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (page: number) => void }) {
    const max = Math.max(1, Math.ceil(total / pageSize));
    return (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
            <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-xl border border-slate-200 p-2 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <span className="font-semibold text-slate-700">{page} / {max}</span>
            <button type="button" disabled={page >= max} onClick={() => onChange(page + 1)} className="rounded-xl border border-slate-200 p-2 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
    );
}

export default function SellerProductsClient({ tenant }: { tenant: string }) {
    const [data, setData] = useState<ResponseData | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
    const [selectedQ, setSelectedQ] = useState("");
    const [availableQ, setAvailableQ] = useState("");
    const [selectedPage, setSelectedPage] = useState(1);
    const [availablePage, setAvailablePage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [checkedSelected, setCheckedSelected] = useState<Set<string>>(new Set());
    const [checkedAvailable, setCheckedAvailable] = useState<Set<string>>(new Set());
    const [orderDraft, setOrderDraft] = useState<Record<string, number>>({});
    const [visibilityDraft, setVisibilityDraft] = useState<Record<string, "visible" | "hidden">>({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ selectedQ, availableQ, selectedPage: String(selectedPage), availablePage: String(availablePage), pageSize: String(pageSize) });
            const response = await fetch(`/api/seller/${encodeURIComponent(tenant)}/products?${params}`, { cache: "no-store", credentials: "include" });
            const payload = (await response.json().catch(() => null)) as ResponseData | null;
            if (!response.ok || !payload?.ok) throw new Error(payload?.message || "상품 정보를 불러오지 못했습니다.");
            setData(payload);
            setCheckedSelected(new Set());
            setCheckedAvailable(new Set());
            setOrderDraft(Object.fromEntries((payload.selected?.items || []).map((item) => [item.id, item.displayOrder])));
            setVisibilityDraft(Object.fromEntries((payload.selected?.items || []).map((item) => [item.id, item.displayStatus])));
        } catch (error) {
            setMessage({ type: "error", text: error instanceof Error ? error.message : "상품 정보를 불러오지 못했습니다." });
        } finally {
            setLoading(false);
        }
    }, [tenant, selectedQ, availableQ, selectedPage, availablePage, pageSize]);

    useEffect(() => {
        const timer = window.setTimeout(load, 250);
        return () => window.clearTimeout(timer);
    }, [load]);

    async function mutate(path: string, method: "POST" | "DELETE" | "PATCH", body: unknown, successText: string) {
        setBusy(true);
        setMessage(null);
        try {
            const response = await fetch(`/api/seller/${encodeURIComponent(tenant)}/products/${path}`, {
                method, credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.ok) throw new Error(payload?.message || "처리하지 못했습니다.");
            setMessage({ type: "ok", text: `${successText}: ${Number(payload.count || 0)}개` });
            await load();
        } catch (error) {
            setMessage({ type: "error", text: error instanceof Error ? error.message : "처리하지 못했습니다." });
        } finally {
            setBusy(false);
        }
    }

    const selected = data?.selected ?? EMPTY_LIST;
    const available = data?.available ?? EMPTY_LIST;
    const summary = data?.summary;
    const allSelectedOnPage = selected.items.length > 0 && selected.items.every((item) => checkedSelected.has(item.id));
    const allAvailableOnPage = available.items.length > 0 && available.items.every((item) => checkedAvailable.has(item.id));

    function toggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
        setter((before) => {
            const next = new Set(before);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    function downloadSelected() {
        csvDownload(`링커_등록상품_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.csv`, [
            ["상품번호", "상품명", "카테고리", "판매가", "상품상태", "진열상태", "진열순서", "슬롯포함", "판매건수", "판매수량", "등록일"],
            ...selected.items.map((item) => [item.id, item.name, item.category, item.price, item.productStatus, item.displayStatus === "visible" ? "진열 중" : "숨김", item.displayOrder, item.slotCounted ? "포함" : "제외", item.salesCount, item.salesQuantity, dateText(item.selectedAt)]),
        ]);
    }

    function downloadAvailable() {
        csvDownload(`링커_미등록상품_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.csv`, [
            ["상품번호", "상품명", "카테고리", "판매가", "재고", "등록가능", "등록불가사유"],
            ...available.items.map((item) => [item.id, item.name, item.category, item.price, item.stock, item.canRegister ? "가능" : "불가", item.unavailableReason || ""]),
        ]);
    }

    const cardItems = useMemo(() => summary ? [
        ["현재 등급", summary.grade], ["최대 슬롯", `${summary.slotLimit}개`], ["사용 슬롯", `${summary.slotUsed}개`],
        ["남은 슬롯", `${summary.slotRemaining}개`], ["전체 등록", `${summary.selectedTotal}개`], ["판매 중지", `${summary.stoppedTotal}개`],
    ] : [], [summary]);

    return (
        <div className="space-y-5">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h1 className="text-2xl font-extrabold tracking-[-0.04em] text-slate-900">링커 상품 관리</h1><p className="mt-1 text-sm text-slate-500">등록 상품의 슬롯, 진열 여부와 노출 순서를 관리합니다.</p></div>
                    <button type="button" onClick={load} disabled={loading || busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"><RefreshCw className="h-4 w-4" />새로고침</button>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
                    {cardItems.map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><div className="text-xs font-semibold text-slate-500">{label}</div><div className="mt-2 text-xl font-extrabold text-slate-900">{value}</div></div>)}
                </div>
                {summary && summary.slotExceeded > 0 ? <div className="mt-4 flex gap-2 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700 ring-1 ring-rose-200"><AlertCircle className="h-5 w-5 shrink-0" />현재 등급의 최대 슬롯을 {summary.slotExceeded}개 초과했습니다. 등록 상품을 정리한 후 신규 등록할 수 있습니다.</div> : null}
                {message ? <div className={`mt-4 rounded-2xl p-4 text-sm font-semibold ${message.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message.text}</div> : null}
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold text-slate-900">등록된 상품</h2><p className="mt-1 text-sm text-slate-500">총 {selected.total.toLocaleString("ko-KR")}개</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={downloadSelected} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"><Download className="h-4 w-4" />엑셀용 CSV</button><button type="button" disabled={busy || checkedSelected.size === 0} onClick={() => window.confirm(`선택한 ${checkedSelected.size}개 상품을 삭제하시겠습니까?`) && mutate("select", "DELETE", { productIds: [...checkedSelected], scope: "selected" }, "상품 삭제 완료")} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"><Trash2 className="h-4 w-4" />선택 상품 삭제</button><button type="button" disabled={busy || selected.allIds.length === 0} onClick={() => window.confirm(`현재 검색 결과 ${selected.total}개 상품을 모두 삭제하시겠습니까?`) && mutate("select", "DELETE", { productIds: selected.allIds, scope: "filtered_all" }, "상품 삭제 완료")} className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40">검색 결과 전체 삭제</button></div></div>
                <div className="mt-4 flex flex-wrap gap-2"><input value={selectedQ} onChange={(event) => { setSelectedQ(event.target.value); setSelectedPage(1); }} placeholder="상품명 또는 상품번호 검색" className="min-w-[240px] flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500" /><select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-xl border border-slate-200 px-3 text-sm"><option value={20}>20개</option><option value={50}>50개</option><option value={100}>100개</option></select><button type="button" disabled={busy || selected.items.length === 0} onClick={() => mutate("order", "PATCH", { items: selected.items.map((item) => ({ productId: item.id, displayOrder: orderDraft[item.id] ?? item.displayOrder, displayStatus: visibilityDraft[item.id] ?? item.displayStatus })) }, "진열 정보 저장 완료")} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><Save className="h-4 w-4" />순서 저장</button></div>
                <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3"><input type="checkbox" checked={allSelectedOnPage} onChange={() => setCheckedSelected(allSelectedOnPage ? new Set() : new Set(selected.items.map((item) => item.id)))} /></th><th className="p-3">상품</th><th className="p-3">상태</th><th className="p-3">판매가</th><th className="p-3">판매 이력</th><th className="p-3">슬롯</th><th className="p-3">진열</th><th className="p-3">순서</th><th className="p-3">등록일</th><th className="p-3">관리</th></tr></thead><tbody className="divide-y divide-slate-100">{selected.items.map((item) => <tr key={item.id} className={!item.slotCounted ? "bg-amber-50/60" : ""}><td className="p-3"><input type="checkbox" checked={checkedSelected.has(item.id)} onChange={() => toggle(setCheckedSelected, item.id)} /></td><td className="p-3"><div className="flex items-center gap-3">{item.image ? <img src={item.image} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100"><Package className="h-5 w-5 text-slate-400" /></div>}<div><div className="font-bold text-slate-900">{item.name}</div><div className="text-xs text-slate-400">#{item.id} · {item.category}</div></div></div></td><td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.slotCounted ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{item.productStatus}</span>{!item.slotCounted ? <div className="mt-1 text-xs text-amber-700">슬롯 제외 · 판매 이력 보관</div> : null}</td><td className="p-3 font-semibold">{money(item.price)}</td><td className="p-3 text-xs">{item.salesCount}건 / {item.salesQuantity}개</td><td className="p-3">{item.slotCounted ? "포함" : "제외"}</td><td className="p-3"><select value={visibilityDraft[item.id] ?? item.displayStatus} onChange={(event) => setVisibilityDraft((before) => ({ ...before, [item.id]: event.target.value as "visible" | "hidden" }))} className="rounded-lg border border-slate-200 p-2"><option value="visible">진열 중</option><option value="hidden">숨김</option></select></td><td className="p-3"><input type="number" min={1} value={orderDraft[item.id] ?? item.displayOrder} onChange={(event) => setOrderDraft((before) => ({ ...before, [item.id]: Number(event.target.value) }))} className="w-20 rounded-lg border border-slate-200 p-2" /></td><td className="p-3 text-xs text-slate-500">{dateText(item.selectedAt)}</td><td className="p-3"><button type="button" disabled={busy} onClick={() => window.confirm(`${item.name} 상품을 삭제하시겠습니까?`) && mutate("select", "DELETE", { productIds: [item.id], scope: "single" }, "상품 삭제 완료")} className="rounded-lg border border-rose-200 px-3 py-2 font-semibold text-rose-700">삭제</button></td></tr>)}</tbody></table>{!loading && selected.items.length === 0 ? <div className="py-12 text-center text-sm text-slate-500">등록된 상품이 없습니다.</div> : null}</div>
                <Pager page={selected.page} total={selected.total} pageSize={selected.pageSize} onChange={setSelectedPage} />
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold text-slate-900">등록 가능한 상품</h2><p className="mt-1 text-sm text-slate-500">총 {available.total.toLocaleString("ko-KR")}개</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={downloadAvailable} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"><Download className="h-4 w-4" />엑셀용 CSV</button><button type="button" disabled={busy || checkedAvailable.size === 0 || summary?.registrationBlocked} onClick={() => mutate("select", "POST", { productIds: [...checkedAvailable], scope: "selected" }, "상품 등록 완료")} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"><Plus className="h-4 w-4" />선택 상품 등록</button><button type="button" disabled={busy || available.allIds.length === 0 || summary?.registrationBlocked} onClick={() => window.confirm(`현재 검색 결과 ${available.total}개 상품을 모두 등록하시겠습니까?`) && mutate("select", "POST", { productIds: available.allIds, scope: "filtered_all" }, "상품 등록 완료")} className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-40">검색 결과 전체 등록</button></div></div>
                <input value={availableQ} onChange={(event) => { setAvailableQ(event.target.value); setAvailablePage(1); }} placeholder="상품명 또는 상품번호 검색" className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3"><input type="checkbox" checked={allAvailableOnPage} onChange={() => setCheckedAvailable(allAvailableOnPage ? new Set() : new Set(available.items.map((item) => item.id)))} /></th><th className="p-3">상품</th><th className="p-3">상태</th><th className="p-3">판매가</th><th className="p-3">재고</th><th className="p-3">등록 가능</th><th className="p-3">관리</th></tr></thead><tbody className="divide-y divide-slate-100">{available.items.map((item) => <tr key={item.id}><td className="p-3"><input type="checkbox" checked={checkedAvailable.has(item.id)} onChange={() => toggle(setCheckedAvailable, item.id)} /></td><td className="p-3"><div className="flex items-center gap-3">{item.image ? <img src={item.image} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="h-12 w-12 rounded-xl bg-slate-100" />}<div><div className="font-bold text-slate-900">{item.name}</div><div className="text-xs text-slate-400">#{item.id} · {item.category}</div></div></div></td><td className="p-3">{item.productStatus}</td><td className="p-3 font-semibold">{money(item.price)}</td><td className="p-3">{item.stock.toLocaleString("ko-KR")}개</td><td className="p-3 text-emerald-700">가능</td><td className="p-3"><button type="button" disabled={busy || summary?.registrationBlocked} onClick={() => mutate("select", "POST", { productIds: [item.id], scope: "single" }, "상품 등록 완료")} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-40">등록</button></td></tr>)}</tbody></table>{!loading && available.items.length === 0 ? <div className="py-12 text-center text-sm text-slate-500">등록 가능한 상품이 없습니다.</div> : null}</div>
                <Pager page={available.page} total={available.total} pageSize={available.pageSize} onChange={setAvailablePage} />
            </section>
        </div>
    );
}
