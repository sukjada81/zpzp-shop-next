// src/app/(admin)/admin/tenant/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Tenant = {
    id: string;
    slug: string;
    name: string;
    status: string;
    primaryDomain: string | null;
    timezone: string;
    themeJson: any | null;
    createdAt: string;
    updatedAt: string;
};

export default function AdminTenantEditPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = params?.id;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [tenant, setTenant] = useState<Tenant | null>(null);

    const [slug, setSlug] = useState("");
    const [name, setName] = useState("");
    const [status, setStatus] = useState("active");
    const [primaryDomain, setPrimaryDomain] = useState("");
    const [timezone, setTimezone] = useState("Asia/Seoul");
    const [themeJsonText, setThemeJsonText] = useState<string>("{}");
    const [openchatUrl, setOpenchatUrl] = useState<string>("");

    useEffect(() => {
        if (!id) return;
        let alive = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/admin/tenants/${encodeURIComponent(id)}`, {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                });
                const data = await res.json().catch(() => null);
                if (!res.ok || !data?.ok) throw new Error(data?.message || `LOAD_FAILED:${res.status}`);

                const t: Tenant = data.tenant;
                if (!alive) return;

                setTenant(t);
                setSlug(t.slug);
                setName(t.name);
                setStatus(t.status);
                setPrimaryDomain(t.primaryDomain ?? "");
                setTimezone(t.timezone ?? "Asia/Seoul");
                const parsedTheme = t.themeJson ?? {};
                setThemeJsonText(JSON.stringify(parsedTheme, null, 2));
                setOpenchatUrl(typeof parsedTheme?.openchatUrl === "string" ? parsedTheme.openchatUrl : "");
            } catch (e: any) {
                if (alive) setError(e?.message || "불러오기 실패");
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [id]);

    if (loading) {
        return (
            <div className="dad-card p-4 text-sm text-[var(--dad-muted)]">
                불러오는 중…
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-3">
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
                <button
                    className="dad-btn dad-btn-ghost inline-flex h-10 items-center justify-center px-4 text-sm"
                    onClick={() => router.back()}
                >
                    뒤로
                </button>
            </div>
        );
    }

    if (!tenant) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between gap-2">
                <div>
                    <h1 className="text-lg font-extrabold text-[var(--dad-ink)]">지점 수정</h1>
                    <p className="mt-1 text-sm text-[var(--dad-muted)]">
                        ID: <span className="font-mono">{tenant.id}</span> / updated: {tenant.updatedAt}
                    </p>
                </div>
                <button
                    className="dad-btn dad-btn-ghost inline-flex h-10 items-center justify-center px-4 text-sm"
                    onClick={() => router.back()}
                    disabled={saving}
                >
                    뒤로
                </button>
            </div>

            <div className="dad-card p-4 space-y-3">
                <Field label="slug" value={slug} onChange={setSlug} mono />
                <Field label="이름" value={name} onChange={setName} />
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
                    value={themeJsonText}
                    onChange={setThemeJsonText}
                    mono
                    onBlur={() => {
                        try {
                            const parsed = JSON.parse(themeJsonText);
                            if (typeof parsed?.openchatUrl === "string") {
                                setOpenchatUrl(parsed.openchatUrl);
                            }
                        } catch {
                            // 편집 중일 수 있으므로 무시
                        }
                    }}
                />

                {error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                ) : null}

                <div className="flex items-center justify-end">
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
                            const tj = themeJsonText.trim();
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
                                const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenant.id)}`, {
                                    method: "PUT",
                                    credentials: "include",
                                    headers: { "content-type": "application/json" },
                                    body: JSON.stringify({
                                        slug: s,
                                        name: n,
                                        status,
                                        primaryDomain: primaryDomain.trim() || null,
                                        timezone: timezone.trim() || "Asia/Seoul",
                                        themeJson: theme,
                                    }),
                                });

                                const data = await res.json().catch(() => null);
                                if (!res.ok || !data?.ok) throw new Error(data?.message || `SAVE_FAILED:${res.status}`);

                                // 저장 후 다시 로드(화면 동기화)
                                router.refresh();
                            } catch (e: any) {
                                setError(e?.message || "저장 실패");
                            } finally {
                                setSaving(false);
                            }
                        }}
                    >
                        {saving ? "저장 중…" : "저장"}
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
                      onBlur,
                  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    mono?: boolean;
    onBlur?: () => void;
}) {
    return (
        <div className="space-y-1">
            <div className="text-xs font-extrabold text-[var(--dad-muted)]">{label}</div>
            <textarea
                className={`min-h-[160px] w-full rounded-xl border border-[var(--dad-border)] bg-white px-3 py-2 text-xs text-[var(--dad-ink)] ${
                    mono ? "font-mono" : ""
                }`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                onBlur={onBlur}
            />
        </div>
    );
}