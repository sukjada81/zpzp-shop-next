"use client";

import { useEffect, useState } from "react";

type LinkerRow = {
    linkerUid: number;
    shopSlug: string;
    shopName: string;
    linkerStatus: string;
    displayStatus: string;
    displayOrder: number;
    selectedAt: string;
    storeVisible: boolean;
};

type ProductRow = {
    productId: string;
    name: string;
    price: number;
    image: string;
    displayStatus: string;
    displayOrder: number;
    selectedAt: string;
    productStatus: string;
    storeVisible: boolean;
};

type ModalProps =
    | {
          kind: "product-linkers";
          productId: string;
          productTitle: string;
          onClose: () => void;
      }
    | {
          kind: "linker-products";
          linkerUid: number;
          linkerLabel: string;
          onClose: () => void;
      };

function money(n: number) {
    return `${Number(n || 0).toLocaleString("ko-KR")}원`;
}

export default function LinkerProductDetailModal(props: ModalProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [title, setTitle] = useState("");
    const [subtitle, setSubtitle] = useState("");
    const [linkers, setLinkers] = useState<LinkerRow[]>([]);
    const [products, setProducts] = useState<ProductRow[]>([]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError("");
            try {
                const url =
                    props.kind === "product-linkers"
                        ? `/api/admin/linker-products/products/${encodeURIComponent(props.productId)}/linkers`
                        : `/api/admin/linker-products/linkers/${encodeURIComponent(String(props.linkerUid))}/products`;

                const res = await fetch(url, { cache: "no-store" });
                const data = await res.json().catch(() => null);
                if (!res.ok || !data?.ok) {
                    throw new Error(data?.message || "불러오기에 실패했습니다.");
                }
                if (cancelled) return;

                if (props.kind === "product-linkers") {
                    setTitle(String(data.product?.name ?? props.productTitle));
                    setSubtitle(`진열 링커 ${data.activeCount ?? 0}명 / 등록 ${data.total ?? 0}명`);
                    setLinkers(Array.isArray(data.items) ? data.items : []);
                    setProducts([]);
                } else {
                    setTitle(String(data.linker?.shopName ?? props.linkerLabel));
                    setSubtitle(
                        `${data.linker?.shopSlug ?? ""} · 스토어 노출 ${data.activeCount ?? 0}개 / 등록 ${data.total ?? 0}개`
                    );
                    setProducts(Array.isArray(data.items) ? data.items : []);
                    setLinkers([]);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : "불러오기에 실패했습니다.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, [props]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={props.onClose}>
            <div
                role="dialog"
                aria-modal="true"
                className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="border-b border-[var(--dad-border)] px-5 py-4">
                    <div className="text-lg font-extrabold text-[var(--dad-ink)]">{title || "상세"}</div>
                    {subtitle ? <div className="mt-1 text-sm text-[var(--dad-muted)]">{subtitle}</div> : null}
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-5">
                    {loading ? (
                        <div className="py-16 text-center text-sm font-semibold text-[var(--dad-muted)]">불러오는 중...</div>
                    ) : error ? (
                        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
                    ) : props.kind === "product-linkers" ? (
                        linkers.length === 0 ? (
                            <div className="py-16 text-center text-sm font-semibold text-[var(--dad-muted)]">진열 중인 링커가 없습니다.</div>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="text-xs font-extrabold text-[var(--dad-muted)]">
                                    <tr>
                                        <th className="pb-3 pr-3">링커</th>
                                        <th className="pb-3 pr-3">샵 URL</th>
                                        <th className="pb-3 pr-3">진열</th>
                                        <th className="pb-3 pr-3">순서</th>
                                        <th className="pb-3">스토어</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {linkers.map((item) => (
                                        <tr key={item.linkerUid} className="border-t border-[var(--dad-border)]">
                                            <td className="py-3 pr-3 font-bold">{item.shopName || item.shopSlug}</td>
                                            <td className="py-3 pr-3 text-[var(--dad-muted)]">{item.shopSlug}.zpzp.kr</td>
                                            <td className="py-3 pr-3">{item.displayStatus === "visible" ? "진열" : "숨김"}</td>
                                            <td className="py-3 pr-3">{item.displayOrder}</td>
                                            <td className="py-3">
                                                <span className={`rounded-full px-2 py-1 text-xs font-bold ${item.storeVisible ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                                    {item.storeVisible ? "노출 중" : "미노출"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    ) : products.length === 0 ? (
                        <div className="py-16 text-center text-sm font-semibold text-[var(--dad-muted)]">등록된 상품이 없습니다.</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="text-xs font-extrabold text-[var(--dad-muted)]">
                                <tr>
                                    <th className="pb-3 pr-3">상품</th>
                                    <th className="pb-3 pr-3">판매가</th>
                                    <th className="pb-3 pr-3">상태</th>
                                    <th className="pb-3 pr-3">진열</th>
                                    <th className="pb-3">스토어</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((item) => (
                                    <tr key={item.productId} className="border-t border-[var(--dad-border)]">
                                        <td className="py-3 pr-3">
                                            <div className="flex items-center gap-3">
                                                {item.image ? (
                                                    <img src={item.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                                                ) : (
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-400">NO</div>
                                                )}
                                                <div>
                                                    <div className="font-bold">{item.name}</div>
                                                    <div className="text-xs text-[var(--dad-muted)]">#{item.productId}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 pr-3 font-semibold">{money(item.price)}</td>
                                        <td className="py-3 pr-3">{item.productStatus}</td>
                                        <td className="py-3 pr-3">{item.displayStatus === "visible" ? "진열" : "숨김"}</td>
                                        <td className="py-3">
                                            <span className={`rounded-full px-2 py-1 text-xs font-bold ${item.storeVisible ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                                {item.storeVisible ? "노출 중" : "미노출"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="border-t border-[var(--dad-border)] px-5 py-4">
                    <button type="button" onClick={props.onClose} className="dad-btn dad-btn-primary h-10 w-full text-sm">
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
