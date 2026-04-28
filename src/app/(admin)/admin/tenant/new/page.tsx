// src/app/(admin)/admin/tenant/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminTenantNewPage() {
    const router = useRouter();
    const [slug, setSlug] = useState("");
    const [name, setName] = useState("");
    const [status, setStatus] = useState("active");
    const [primaryDomain, setPrimaryDomain] = useState("");
    const [timezone, setTimezone] = useState("Asia/Seoul");
    const [themeJson, setThemeJson] = useState<string>("{}");
    const [openchatUrl, setOpenchatUrl] = useState<string>("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-lg font-extrabold text-[var(--dad-ink)]">지점 생성</h1>
                <p className="mt-1 text-sm text-[var(--dad-muted)]">slug/domain/status/themeJson 설정</p>
            </div>

            <div className="dad-card p-4 space-y-3">
                <Field label="slug" value={slug} onChange={setSlug} placeholder="예) a" mono />
                <Field label="이름" value={name} onChange={setName} placeholder="예) A지점" />
                <Select
                    label="상태"
                    value={status}
                    onChange={setStatus}
                    options={[
                        { value: "active", label: "active" },
                        { value: "inactive", label: "inactive" },
                        { value: "draft", label: "draft" },
                    ]}
                />
                <Field label="도메인" value={primaryDomain} onChange={setPrimaryDomain} placeholder="예) a.example.com" />
                <Field label="타임존" value={timezone} onChange={setTimezone} placeholder="예) Asia/Seoul" />
                <Field
                    label="오픈채팅방 URL"
                    value={openchatUrl}
                    onChange={setOpenchatUrl}
                    placeholder="https://open.kakao.com/o/..."
                />
                <TextArea
                    label="themeJson (JSON)"
                    value={themeJson}
                    onChange={setThemeJson}
                    placeholder={`예)\n{\n  "brandColor": "#111111",\n  "accentColor": "#22c55e"\n}`}
                    mono
                />

                {error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                    <button
                        className="dad-btn dad-btn-ghost inline-flex h-10 items-center justify-center px-4 text-sm"
                        onClick={() => router.back()}
                        disabled={saving}
                    >
                        취소
                    </button>
                    <button
                        className="dad-btn dad-btn-primary inline-flex h-10 items-center justify-center px-4 text-sm"
                        disabled={saving}
                        onClick={async () => {
                            setError(null);
                            const s = slug.trim();
                            const n = name.trim();
                            if (!s) return setError("slug는 필수입니다.");
                            if (!n) return setError("이름은 필수입니다.");

                            let theme: Record<string, any> = {};
                            const tj = themeJson.trim();
                            if (tj) {
                                try {
                                    theme = JSON.parse(tj);
                                } catch {
                                    return setError("themeJson은 유효한 JSON이어야 합니다.");
                                }
                            }

                            const urlVal = openchatUrl.trim();
                            if (urlVal) {
                                theme.openchatUrl = urlVal;
                            } else {
                                delete theme.openchatUrl;
                            }

                            setSaving(true);
                            try {
                                const res = await fetch("/api/admin/tenants", {
                                    method: "POST",
                                    credentials: "include",
                                    headers: { "content-type": "application/json" },
                                    body: JSON.stringify({
                                        slug: s,
                                        name: n,
                                        status,
                                        primaryDomain: primaryDomain.trim() || null,
                                        timezone: timezone.trim() || "Asia/Seoul",
                                        themeJson: Object.keys(theme).length > 0 ? theme : null,
                                    }),
                                });

                                const data = await res.json().catch(() => null);
                                if (!res.ok || !data?.ok) {
                                    throw new Error(data?.message || `CREATE_FAILED:${res.status}`);
                                }

                                // 생성 후 상세 페이지로
                                router.push(`/tenant/${data.tenant.id}`);
                            } catch (e: any) {
                                setError(e?.message || "생성 실패");
                            } finally {
                                setSaving(false);
                            }
                        }}
                    >
                        {saving ? "생성 중…" : "생성"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({
                   label,
                   value,
                   onChange,
                   placeholder,
                   mono,
               }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    mono?: boolean;
}) {
    return (
        <div className="space-y-1">
            <div className="text-xs font-extrabold text-[var(--dad-muted)]">{label}</div>
            <input
                className={`h-10 w-full rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm text-[var(--dad-ink)] ${
                    mono ? "font-mono" : ""
                }`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
        </div>
    );
}

function Select({
                    label,
                    value,
                    onChange,
                    options,
                }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: Array<{ value: string; label: string }>;
}) {
    return (
        <div className="space-y-1">
            <div className="text-xs font-extrabold text-[var(--dad-muted)]">{label}</div>
            <select
                className="h-10 w-full rounded-xl border border-[var(--dad-border)] bg-white px-3 text-sm text-[var(--dad-ink)]"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

function TextArea({
                      label,
                      value,
                      onChange,
                      placeholder,
                      mono,
                  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    mono?: boolean;
}) {
    return (
        <div className="space-y-1">
            <div className="text-xs font-extrabold text-[var(--dad-muted)]">{label}</div>
            <textarea
                className={`min-h-[140px] w-full rounded-xl border border-[var(--dad-border)] bg-white px-3 py-2 text-xs text-[var(--dad-ink)] ${
                    mono ? "font-mono" : ""
                }`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
        </div>
    );
}