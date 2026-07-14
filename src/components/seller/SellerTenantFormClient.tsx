// src/components/seller/SellerTenantFormClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TenantDto = {
    id: number;
    slug: string;
    name: string;
    status: "active" | "inactive" | "draft" | string;
    primaryDomain: string | null;
    timezone?: string;
    openchatUrl: string | null;
};

const ERROR_MAP: Record<string, string> = {
    "login required": "로그인이 필요합니다.",
    "invalid session": "세션이 만료되었습니다. 다시 로그인해 주세요.",
    "super admin required": "최고권한자만 변경할 수 있습니다.",
    "admin permission required": "권한이 없습니다.",
    "INVALID_ID": "잘못된 요청입니다.",
    "SLUG_REQUIRED": "지점 코드는 필수입니다.",
    "NAME_REQUIRED": "이름은 필수입니다.",
    "INVALID_STATUS": "상태값이 올바르지 않습니다.",
    "SLUG_ALREADY_EXISTS": "이미 사용 중인 지점 코드입니다.",
    "PRIMARY_DOMAIN_ALREADY_EXISTS": "이미 사용 중인 도메인입니다.",
    "TENANT_NOT_FOUND": "지점을 찾을 수 없습니다.",
};

function translateError(code: string | undefined): string {
    if (!code) return "저장 중 오류가 발생했습니다.";
    return ERROR_MAP[code] ?? "저장 중 오류가 발생했습니다.";
}

export default function SellerTenantFormClient({
    mode,
    tenant,
}: {
    mode: "new" | "edit";
    tenant?: TenantDto;
}) {
    const router = useRouter();
    const [slug, setSlug] = useState(tenant?.slug ?? "");
    const [name, setName] = useState(tenant?.name ?? "");
    const [status, setStatus] = useState<string>(tenant?.status ?? "active");
    const [primaryDomain, setPrimaryDomain] = useState(tenant?.primaryDomain ?? "");
    const [openchatUrl, setOpenchatUrl] = useState(tenant?.openchatUrl ?? "");
    const [saving, setSaving] = useState(false);
    const [deactivating, setDeactivating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEdit = mode === "edit";

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const trimmedSlug = slug.trim();
        const trimmedName = name.trim();
        if (!isEdit && !trimmedSlug) {
            setError("지점 코드는 필수입니다.");
            return;
        }
        if (!trimmedName) {
            setError("이름은 필수입니다.");
            return;
        }

        setSaving(true);
        try {
            const url = isEdit
                ? `/api/proxy/v1/seller/tenants/${tenant!.id}`
                : "/api/proxy/v1/seller/tenants";
            const method = isEdit ? "PUT" : "POST";
            const body = isEdit
                ? {
                      name: trimmedName,
                      status,
                      primaryDomain: primaryDomain.trim(),
                      openchatUrl: openchatUrl.trim(),
                  }
                : {
                      slug: trimmedSlug,
                      name: trimmedName,
                      status,
                      primaryDomain: primaryDomain.trim(),
                      openchatUrl: openchatUrl.trim(),
                  };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.ok) {
                setError(translateError(json?.message));
                return;
            }
            router.push("/__all__/tenants");
            router.refresh();
        } catch {
            setError("네트워크 오류 — 잠시 후 다시 시도해 주세요.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDeactivate() {
        if (!isEdit || !tenant) return;
        if (
            !window.confirm(
                "이 지점을 운영 중지하시겠습니까? 사이트 접근이 차단되지만 데이터는 보존됩니다."
            )
        )
            return;

        setDeactivating(true);
        setError(null);
        try {
            const res = await fetch(`/api/proxy/v1/seller/tenants/${tenant.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ status: "inactive" }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.ok) {
                setError(translateError(json?.message));
                return;
            }
            router.push("/__all__/tenants");
            router.refresh();
        } catch {
            setError("네트워크 오류 — 잠시 후 다시 시도해 주세요.");
        } finally {
            setDeactivating(false);
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
        >
            <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-slate-900">
                {isEdit ? "지점 수정" : "지점 신규 등록"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
                {isEdit
                    ? "지점 정보를 수정합니다. 지점 코드는 변경할 수 없습니다."
                    : "새 지점을 등록합니다. 지점 코드는 생성 후 변경할 수 없습니다."}
            </p>

            {error ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            ) : null}

            <div className="mt-6 space-y-4">
                <div>
                    <label className="text-xs font-semibold text-slate-500">
                        지점 코드{isEdit ? " (수정 불가)" : ""}
                    </label>
                    <input
                        type="text"
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        disabled={isEdit}
                        placeholder="예) a"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                        사이트 주소에 사용됩니다. 예) 입력값이 a 이면 a.zpzp.kr · 영문 소문자/숫자만
                    </p>
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500">이름</label>
                    <input
                        type="text"
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="예) A지점"
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500">상태</label>
                    <select
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="active">운영중</option>
                        <option value="inactive">운영중지</option>
                        <option value="draft">준비중</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500">도메인</label>
                    <input
                        type="text"
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        value={primaryDomain}
                        onChange={(e) => setPrimaryDomain(e.target.value)}
                        placeholder="예) a.zpzp.kr"
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500">오픈채팅 URL</label>
                    <input
                        type="text"
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        value={openchatUrl}
                        onChange={(e) => setOpenchatUrl(e.target.value)}
                        placeholder="https://open.kakao.com/o/..."
                    />
                </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={() => router.push("/__all__/tenants")}
                    disabled={saving || deactivating}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-60"
                >
                    취소
                </button>
                {isEdit && status !== "inactive" ? (
                    <button
                        type="button"
                        onClick={handleDeactivate}
                        disabled={saving || deactivating}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                        {deactivating ? "처리 중..." : "이 지점 운영 중지"}
                    </button>
                ) : null}
                <button
                    type="submit"
                    disabled={saving || deactivating}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                    {saving ? "저장 중..." : "저장"}
                </button>
            </div>
        </form>
    );
}
