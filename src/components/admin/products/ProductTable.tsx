"use client";

// src/components/admin/products/ProductTable.tsx
import Link from "next/link";
import { statusLabel } from "@/lib/admin/productStatus";

export default function ProductTable({ rows }: { rows: any[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                <tr className="border-b border-[var(--dad-border)] text-xs font-extrabold text-[var(--dad-muted)]">
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 pr-3">지점</th>
                    <th className="py-3 pr-3">상품명</th>
                    <th className="py-3 pr-3">상태</th>
                    <th className="py-3 pr-3 text-right">판매가</th>
                    <th className="py-3 pr-3">등록/수정</th>
                    <th className="py-3 pr-4 text-right">관리</th>
                </tr>
                </thead>
                <tbody>
                {(rows || []).map((p) => {
                    const id = String(p?.id ?? p?.uid ?? "");
                    const title = String(p?.title ?? p?.name ?? p?.goods_name ?? "");
                    const tenant =
                        String(p?.tenant?.slug ?? p?.tenantSlug ?? p?.tenant_slug ?? "") ||
                        String(p?.tenant_id ?? p?.tenantId ?? "");

                    const price = Number(p?.price ?? p?.basePrice ?? p?.base_price ?? 0) || 0;
                    const status = statusLabel(p?.status);

                    const created =
                        p?.createdAt ?? p?.signdate ?? p?.moddate ?? null;

                    const createdText =
                        typeof created === "string" && created
                            ? new Date(created).toLocaleString("ko-KR")
                            : typeof created === "number" && created > 0
                                ? new Date(created * 1000).toLocaleString("ko-KR")
                                : "-";

                    return (
                        <tr key={id} className="border-b border-[var(--dad-border)]">
                            <td className="py-3 px-4 font-extrabold text-[var(--dad-ink)]">{id}</td>
                            <td className="py-3 pr-3 font-bold text-[var(--dad-ink)]">{tenant || "-"}</td>
                            <td className="py-3 pr-3">
                                <div className="font-extrabold text-[var(--dad-ink)] line-clamp-1">{title}</div>
                            </td>
                            <td className="py-3 pr-3">
                  <span className="inline-flex items-center rounded-full border border-[var(--dad-border)] bg-white/70 px-3 py-1 text-xs font-extrabold text-[var(--dad-ink)]">
                    {status}
                  </span>
                            </td>
                            <td className="py-3 pr-3 text-right font-extrabold text-[var(--dad-ink)]">
                                {price.toLocaleString()}원
                            </td>
                            <td className="py-3 pr-3 text-xs font-bold text-[var(--dad-muted)]">{createdText}</td>
                            <td className="py-3 pr-4 text-right">
                                <Link href={`/products/${id}`} className="dad-btn dad-btn-ghost h-9 px-3 text-sm">
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