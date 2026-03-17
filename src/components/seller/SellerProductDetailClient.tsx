// src/components/seller/SellerProductDetailClient.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { getSellerHref } from "@/lib/seller/getSellerHref";

type ProductItem = {
    id: string;
    tenant_id: string;
    name: string;
    price: number;
    status: string;
    image: string;
    stock: number;
    detail: string;
    explains: string;
    image1?: string;
    image2?: string;
    image3?: string;
};

const STATUS_OPTIONS = [
    { value: "draft", label: "임시저장" },
    { value: "active", label: "판매중" },
    { value: "soldout", label: "품절" },
    { value: "inactive", label: "숨김" },
];

export default function SellerProductDetailClient({
                                                      tenant,
                                                      id,
                                                  }: {
    tenant: string;
    id: string;
}) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [loaded, setLoaded] = useState<ProductItem | null>(null);

    const [name, setName] = useState("");
    const [price, setPrice] = useState("0");
    const [stock, setStock] = useState("0");
    const [status, setStatus] = useState("draft");
    const [detail, setDetail] = useState("");
    const [explains, setExplains] = useState("<p></p>");

    useEffect(() => {
        let active = true;

        (async () => {
            try {
                setError("");
                const res = await fetch(`/api/seller/${tenant}/products/${id}`, {
                    cache: "no-store",
                    credentials: "include", // ✅ 이거 추가
                });
                const json = await res.json();

                if (!res.ok || !json?.ok) {
                    throw new Error(json?.message || "상품 정보를 불러오지 못했습니다.");
                }

                const item = json.item as ProductItem;
                if (!active) return;

                setLoaded(item);
                setName(item.name || "");
                setPrice(String(item.price ?? 0));
                setStock(String(item.stock ?? 0));
                setStatus(item.status || "draft");
                setDetail(item.detail || "");
                setExplains(item.explains || "<p></p>");
            } catch (e: any) {
                if (active) setError(e?.message || "상품 정보를 불러오지 못했습니다.");
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [tenant, id]);

    async function handleSave() {
        try {
            setSaving(true);
            setError("");

            const res = await fetch(`/api/seller/${tenant}/products/${id}`, {
                method: "PUT",
                headers: {
                    "content-type": "application/json",
                    accept: "application/json",
                },
                body: JSON.stringify({
                    name,
                    price: Number(price || 0),
                    stock: Number(stock || 0),
                    status,
                    detail,
                    explains,
                }),
            });

            const json = await res.json().catch(() => ({}));

            if (!res.ok || !json?.ok) {
                throw new Error(json?.message || "상품 저장에 실패했습니다.");
            }

            alert("상품 수정이 완료되었습니다.");
        } catch (e: any) {
            setError(e?.message || "상품 저장에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="space-y-4 animate-pulse">
                    <div className="h-8 w-40 rounded-xl bg-slate-100" />
                    <div className="h-40 rounded-3xl bg-slate-100" />
                    <div className="h-28 rounded-3xl bg-slate-100" />
                </div>
            </div>
        );
    }

    if (error && !loaded) {
        return (
            <div className="rounded-[28px] border border-rose-200 bg-white p-5 text-rose-700 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="text-base font-bold">상품 정보를 불러오지 못했습니다.</div>
                <div className="mt-2 text-sm">{error}</div>
                <Link
                    href={getSellerHref(tenant, "/products")}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                    <ArrowLeft className="h-4 w-4" />
                    목록으로
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Seller Product
                    </div>
                    <div className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                        상품 수정
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                        매장 상품 정보를 수정합니다.
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href={getSellerHref(tenant, "/products")}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        목록
                    </Link>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                        <Save className="h-4 w-4" />
                        {saving ? "저장 중..." : "저장"}
                    </button>
                </div>
            </div>

            {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    {error}
                </div>
            ) : null}

            <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
                <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                    <div className="text-lg font-bold tracking-[-0.03em] text-slate-900">상품 이미지</div>

                    <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                        <div className="aspect-square">
                            {loaded?.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={loaded.image}
                                    alt={loaded.name}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center text-sm font-medium text-slate-400">
                                    이미지 없음
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-slate-500">
                        <div>상품 ID: {loaded?.id}</div>
                        <div>대표이미지: {loaded?.image1 || "-"}</div>
                        <div>보조이미지: {loaded?.image2 || "-"}</div>
                        <div>썸네일: {loaded?.image3 || "-"}</div>
                    </div>
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="text-sm font-semibold text-slate-700">상품명</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-700">판매가</label>
                            <input
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-700">재고</label>
                            <input
                                type="number"
                                value={stock}
                                onChange={(e) => setStock(e.target.value)}
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-sm font-semibold text-slate-700">상태</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none"
                            >
                                {STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-sm font-semibold text-slate-700">간략설명</label>
                            <textarea
                                value={detail}
                                onChange={(e) => setDetail(e.target.value)}
                                className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-sm font-semibold text-slate-700">상세설명 HTML</label>
                            <textarea
                                value={explains}
                                onChange={(e) => setExplains(e.target.value)}
                                className="mt-2 min-h-[240px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm outline-none"
                            />
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}