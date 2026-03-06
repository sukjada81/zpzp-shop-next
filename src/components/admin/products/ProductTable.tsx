"use client";

import { useState } from "react";
import Link from "next/link";
import { statusLabel } from "@/lib/admin/productStatus";

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

function statusColor(status: string) {
    if (status === "active") return "bg-green-100 text-green-700 border-green-200";
    if (status === "draft") return "bg-gray-100 text-gray-600 border-gray-200";
    if (status === "archived") return "bg-red-100 text-red-600 border-red-200";
    return "bg-white text-gray-600 border-gray-200";
}

export default function ProductTable({ rows }: { rows: any[] }) {
    const [selected, setSelected] = useState<string[]>([]);

    function toggle(id: string) {
        setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
    }

    function toggleAll() {
        if (selected.length === rows.length) {
            setSelected([]);
        } else {
            setSelected(rows.map((p) => String(p.id ?? p.uid)));
        }
    }

    async function bulkStatus(status: string) {
        if (!selected.length) return alert("상품을 선택하세요.");
        alert("일괄 상태 변경 API는 아직 연결 전입니다.");
    }

    return (
        <div className="overflow-x-auto">
            {selected.length > 0 && (
                <div className="sticky top-0 z-20 flex min-w-[1080px] items-center gap-2 border-b border-[var(--dad-border)] bg-white p-3">
                    <div className="text-sm font-bold">선택 {selected.length}개</div>

                    <button onClick={() => bulkStatus("active")} className="dad-btn dad-btn-primary h-8 px-3 text-xs">
                        판매중
                    </button>

                    <button onClick={() => bulkStatus("draft")} className="dad-btn dad-btn-ghost h-8 px-3 text-xs">
                        임시저장
                    </button>

                    <button onClick={() => bulkStatus("archived")} className="dad-btn dad-btn-ghost h-8 px-3 text-xs">
                        보관
                    </button>
                </div>
            )}

            <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
                <colgroup>
                    <col className="w-[36px]" />
                    <col className="w-[62px]" />
                    <col className="w-[92px]" />
                    <col className="w-auto" />
                    <col className="w-[85px]" />
                    <col className="w-[100px]" />
                    <col className="w-[108px]" />
                </colgroup>

                <thead>
                <tr className="border-b border-[var(--dad-border)] text-xs font-extrabold text-[var(--dad-muted)]">
                    <th className="px-2 py-3">
                        <input
                            type="checkbox"
                            checked={rows.length > 0 && selected.length === rows.length}
                            onChange={toggleAll}
                        />
                    </th>
                    <th className="px-2 py-3 text-center">이미지</th>
                    <th className="px-2 py-3 text-center">지점</th>
                    <th className="px-2 py-3 text-center">상품명</th>
                    <th className="px-2 py-3 text-center">상태</th>
                    <th className="px-2 py-3 text-center">가격</th>
                    <th className="sticky right-0 z-10 bg-white px-2 py-3 text-center">관리</th>
                </tr>
                </thead>

                <tbody>
                {(rows || []).map((p) => {
                    const id = String(p?.id ?? p?.uid ?? "");
                    const title = String(p?.title ?? p?.name ?? "");
                    const tenantName = p?.tenant?.name ?? p?.tenantName ?? p?.tenant_slug ?? "-";
                    const image = p?.image1 ?? p?.thumbnailUrl ?? p?.image2 ?? p?.image3 ?? "";
                    const preview = toPreviewUrl(image);
                    const status = String(p?.status ?? "");
                    const price = Number(p?.price ?? p?.basePrice ?? 0);

                    return (
                        <tr key={id} className="border-b border-[var(--dad-border)] hover:bg-gray-50">
                            <td className="px-2 py-3 align-middle">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(id)}
                                    onChange={() => toggle(id)}
                                />
                            </td>

                            <td className="px-2 py-3 align-middle">
                                <div className="group relative">
                                    <div className="h-11 w-11 overflow-hidden rounded-xl border border-[var(--dad-border)] bg-white">
                                        {preview ? (
                                            <img
                                                src={preview}
                                                alt={title}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-full items-center justify-center text-[10px] font-bold text-[var(--dad-muted)]">
                                                NO
                                            </div>
                                        )}
                                    </div>

                                    {preview ? (
                                        <div className="pointer-events-none absolute left-12 top-0 z-20 hidden w-48 overflow-hidden rounded-xl border border-[var(--dad-border)] bg-white shadow-lg group-hover:block">
                                            <img src={preview} alt={`${title}-preview`} className="w-full" />
                                        </div>
                                    ) : null}
                                </div>
                            </td>

                            <td className="px-2 py-3 text-center align-middle">
                                    <span className="inline-flex max-w-full whitespace-nowrap rounded-full bg-orange-100 px-2 py-1 text-[11px] font-bold text-orange-700">
                                        {tenantName}
                                    </span>
                            </td>

                            <td className="px-2 py-3 align-middle font-bold text-[var(--dad-ink)]">
                                <div className="line-clamp-2 break-words leading-5">{title}</div>
                            </td>

                            <td className="px-2 py-3 text-center align-middle">
                                    <span
                                        className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusColor(
                                            status
                                        )}`}
                                    >
                                        {statusLabel(status)}
                                    </span>
                            </td>

                            <td className="px-2 py-3 text-center align-middle font-bold text-[var(--dad-ink)] whitespace-nowrap">
                                {price.toLocaleString()}원
                            </td>

                            <td className="sticky right-0 z-10 bg-white px-2 py-3 text-center align-middle">
                                <Link
                                    href={`/admin/products/${id}`}
                                    className="dad-btn dad-btn-ghost h-8 px-3 text-xs"
                                >
                                    수정
                                </Link>
                            </td>
                        </tr>
                    );
                })}

                {(rows || []).length === 0 && (
                    <tr>
                        <td colSpan={7} className="py-10 text-center text-sm font-bold text-[var(--dad-muted)]">
                            상품 데이터가 없습니다.
                        </td>
                    </tr>
                )}
                </tbody>
            </table>
        </div>
    );
}