"use client";

import { useMemo, useState } from "react";

export type ProductHtmlEditorProps = {
    label?: string;
    value: string;
    onChange: (nextHtml: string) => void;
    placeholder?: string;
    height?: number;
    disabled?: boolean;
};

export default function ProductHtmlEditor({
                                              label = "상세설명(HTML)",
                                              value,
                                              onChange,
                                              placeholder = "<p>상품 상세설명을 입력하세요.</p>",
                                              height = 320,
                                              disabled = false,
                                          }: ProductHtmlEditorProps) {
    const [tab, setTab] = useState<"edit" | "preview">("edit");

    const previewHtml = useMemo(() => {
        if (!value?.trim()) {
            return `<div style="color:#94a3b8;">미리보기 내용이 없습니다.</div>`;
        }
        return value;
    }, [value]);

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-sm font-semibold text-slate-700">{label}</div>

                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                    <button
                        type="button"
                        onClick={() => setTab("edit")}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                            tab === "edit" ? "bg-slate-900 text-white" : "text-slate-600"
                        }`}
                    >
                        편집
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab("preview")}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                            tab === "preview" ? "bg-slate-900 text-white" : "text-slate-600"
                        }`}
                    >
                        미리보기
                    </button>
                </div>
            </div>

            {tab === "edit" ? (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    style={{ minHeight: height }}
                    className="w-full resize-y border-0 p-4 text-sm leading-6 text-slate-800 outline-none"
                />
            ) : (
                <div
                    style={{ minHeight: height }}
                    className="prose prose-sm max-w-none p-4"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
            )}
        </div>
    );
}