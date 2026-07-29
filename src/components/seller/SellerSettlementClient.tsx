// src/components/seller/SellerSettlementClient.tsx
// 링커 정산 화면. 화면 규칙·문구는 shop-php php/settlement.php 와 맞춘다.
// 검증은 서버(lib/settlement_payout.php)가 하므로 여기서는 필수값 안내 수준만 처리하고
// 서버가 돌려준 메시지를 그대로 보여준다(문구 이원화 방지).
"use client";

import { useCallback, useEffect, useState } from "react";
import {
    AlertCircle,
    Banknote,
    CheckCircle2,
    Info,
    Lock,
    Pencil,
    ReceiptText,
    RefreshCw,
    Wallet,
} from "lucide-react";

type BusinessType = "individual" | "sole_proprietor" | "corporation" | "foreigner" | "";

type Profile = {
    businessType: Exclude<BusinessType, "">;
    businessTypeLabel: string;
    bankName: string;
    accountHolder: string;
    companyName: string;
    businessNumberMasked: string;
    accountMasked: string;
};

type RequestRow = {
    uid: number;
    amount: number;
    status: string;
    statusLabel: string;
    rejectReason: string;
    requestedAt: string;
    canCancel: boolean;
};

type LedgerRow = {
    type: string;
    typeLabel: string;
    amount: number;
    amountLabel: string;
    orderNum: string;
    settlementMonth: string;
    date: string;
    note: string;
    couponDiscount: number;
    welcomeDiscount: number;
};

type Summary = {
    linker: { shopSlug: string; shopName: string };
    balance: {
        available: number;
        lifetimeAccrued: number;
        lifetimeReversed: number;
        lifetimePaid: number;
    };
    minAmount: number;
    pending: { uid: number; amount: number; status: string; statusLabel: string } | null;
    profile: Profile | null;
    canRequest: boolean;
    requestDisabledReason: string;
    canEditProfile: boolean;
    requests: RequestRow[];
    ledger: LedgerRow[];
};

type FormState = {
    business_type: BusinessType;
    resident_number: string;
    corp_number: string;
    business_number: string;
    company_name_sole: string;
    company_name_corp: string;
    bank_name: string;
    account_number: string;
    account_holder: string;
};

const EMPTY_FORM: FormState = {
    business_type: "",
    resident_number: "",
    corp_number: "",
    business_number: "",
    company_name_sole: "",
    company_name_corp: "",
    bank_name: "",
    account_number: "",
    account_holder: "",
};

function money(value: number) {
    return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function statusTone(status: string) {
    if (status === "paid") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    if (status === "approved") return "bg-blue-50 text-blue-700 ring-blue-200";
    if (status === "rejected") return "bg-rose-50 text-rose-700 ring-rose-200";
    if (status === "cancelled") return "bg-slate-100 text-slate-500 ring-slate-200";
    return "bg-amber-50 text-amber-700 ring-amber-200"; // pending
}

function Card({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
    return (
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <h2 className="mb-4 flex items-center gap-2 text-base font-extrabold tracking-[-0.02em] text-slate-900">
                <Icon className="h-4 w-4 text-slate-500" />
                {title}
            </h2>
            {children}
        </section>
    );
}

function Field({
    label,
    required,
    children,
    hint,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
    hint?: string;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
                {label}
                {required ? <span className="ml-1 text-rose-500">*</span> : null}
            </span>
            {children}
            {hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
        </label>
    );
}

const inputClass =
    "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500";

export default function SellerSettlementClient({ tenant }: { tenant: string }) {
    const [data, setData] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [blocked, setBlocked] = useState("");
    const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);

    const base = `/api/seller/${encodeURIComponent(tenant)}/settlement`;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(base, { cache: "no-store", credentials: "include" });
            const payload = (await res.json().catch(() => null)) as
                | { ok?: boolean; message?: string; data?: Summary }
                | null;
            if (!res.ok || !payload?.ok || !payload.data) {
                // 403(링커 아님) 등은 화면 전체를 안내로 대체한다.
                setBlocked(payload?.message || "정산 정보를 불러오지 못했습니다.");
                setData(null);
                return;
            }
            setBlocked("");
            setData(payload.data);
            // 정산정보가 아직 없으면 곧바로 입력 폼을 연다(본사몰 화면과 동일).
            setEditing(!payload.data.profile);
        } catch {
            setBlocked("정산 정보를 불러오지 못했습니다.");
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [base]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!message) return;
        const timer = window.setTimeout(() => setMessage(null), 4000);
        return () => window.clearTimeout(timer);
    }, [message]);

    async function post(path: string, body: Record<string, unknown>, fallbackError: string) {
        setBusy(true);
        setMessage(null);
        try {
            const res = await fetch(`${base}${path}`, {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
            });
            const payload = (await res.json().catch(() => null)) as
                | { ok?: boolean; message?: string; data?: Summary }
                | null;

            // 액션 응답에 최신 summary 가 동봉된다 — 실패해도 화면 상태는 갱신한다.
            if (payload?.data) {
                setData(payload.data);
                if (payload.ok) setEditing(false);
            }

            if (!res.ok || !payload?.ok) {
                setMessage({ tone: "error", text: payload?.message || fallbackError });
                return false;
            }
            setMessage({ tone: "ok", text: payload.message || "처리되었습니다." });
            return true;
        } catch {
            setMessage({ tone: "error", text: fallbackError });
            return false;
        } finally {
            setBusy(false);
        }
    }

    function submitProfile(event: React.FormEvent) {
        event.preventDefault();
        if (!form.business_type) {
            setMessage({ tone: "error", text: "사업자 유형을 선택해 주세요." });
            return;
        }
        if (form.business_type === "foreigner") {
            setMessage({
                tone: "error",
                text: "외국인 링커 정산은 별도 안내 예정입니다. 고객센터로 문의해 주세요.",
            });
            return;
        }
        post("/profile", form, "정산정보를 저장하지 못했습니다.");
    }

    function submitRequest() {
        if (!data) return;
        const ok = window.confirm(
            `출금 가능 금액 전액(${money(data.balance.available)})을 신청합니다. 계속할까요?`
        );
        if (!ok) return;
        post("/request", {}, "출금 신청을 처리하지 못했습니다.");
    }

    function cancelRequest(uid: number) {
        if (!window.confirm("출금 신청을 취소할까요?")) return;
        post("/cancel", { req_uid: uid }, "신청을 취소하지 못했습니다.");
    }

    if (loading) {
        return (
            <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                정산 정보를 불러오는 중입니다...
            </div>
        );
    }

    if (blocked || !data) {
        return (
            <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center">
                <AlertCircle className="mx-auto mb-3 h-6 w-6 text-slate-400" />
                <p className="text-sm font-semibold text-slate-700">{blocked || "정산 정보를 볼 수 없습니다."}</p>
                <button
                    type="button"
                    onClick={load}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
                >
                    <RefreshCw className="h-4 w-4" />
                    다시 시도
                </button>
            </div>
        );
    }

    const bt = form.business_type;

    return (
        <div className="space-y-4">
            {message ? (
                <div
                    className={[
                        "flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ring-1",
                        message.tone === "ok"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-rose-50 text-rose-700 ring-rose-200",
                    ].join(" ")}
                >
                    {message.tone === "ok" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <span>{message.text}</span>
                </div>
            ) : null}

            {/* 잔액 */}
            <Card title="내 수수료 잔액" icon={Wallet}>
                <div className="rounded-2xl bg-slate-900 px-5 py-6 text-white">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                        출금 가능 금액
                    </div>
                    <div className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">
                        {money(data.balance.available)}
                    </div>
                    {data.balance.available < 0 ? (
                        <div className="mt-2 text-xs text-amber-300">
                            취소·환불 차감이 적립을 넘어 이월된 상태입니다. 다음 적립분에서 상계됩니다.
                        </div>
                    ) : null}
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {[
                        { label: "누적 적립", value: data.balance.lifetimeAccrued },
                        { label: "누적 차감", value: data.balance.lifetimeReversed },
                        { label: "누적 지급", value: data.balance.lifetimePaid },
                    ].map((item) => (
                        <div key={item.label} className="rounded-2xl bg-slate-50 px-2 py-3">
                            <dt className="text-xs font-semibold text-slate-400">{item.label}</dt>
                            <dd className="mt-1 text-sm font-bold text-slate-800">{money(item.value)}</dd>
                        </div>
                    ))}
                </dl>

                {data.pending ? (
                    <p className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                        <Info className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                            {money(data.pending.amount)} 출금 신청이 {data.pending.statusLabel} 상태입니다.
                        </span>
                    </p>
                ) : null}

                <div className="mt-4">
                    <button
                        type="button"
                        onClick={submitRequest}
                        disabled={busy || !data.canRequest}
                        className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500"
                    >
                        전액 출금 신청
                    </button>
                    <p className="mt-2 text-center text-xs text-slate-400">
                        {data.canRequest
                            ? `최소 신청액 ${money(data.minAmount)} · 전액만 신청할 수 있습니다.`
                            : data.requestDisabledReason}
                    </p>
                </div>
            </Card>

            {/* 정산정보 */}
            <Card title="정산정보" icon={Banknote}>
                {!editing && data.profile ? (
                    <>
                        <dl className="divide-y divide-slate-100 text-sm">
                            {[
                                ["사업자 유형", data.profile.businessTypeLabel],
                                ...(data.profile.companyName ? [["상호", data.profile.companyName]] : []),
                                ...(data.profile.businessNumberMasked
                                    ? [["사업자번호", data.profile.businessNumberMasked]]
                                    : []),
                                ["은행", data.profile.bankName],
                                ["계좌번호", data.profile.accountMasked],
                                ["예금주", data.profile.accountHolder],
                            ].map(([label, value]) => (
                                <div key={label} className="flex items-center justify-between gap-4 py-2.5">
                                    <dt className="text-xs font-semibold text-slate-400">{label}</dt>
                                    <dd className="break-all text-right font-semibold text-slate-800">{value}</dd>
                                </div>
                            ))}
                        </dl>

                        {data.canEditProfile ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setForm({ ...EMPTY_FORM, business_type: data.profile!.businessType });
                                    setEditing(true);
                                }}
                                className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                <Pencil className="h-4 w-4" />
                                정산정보 수정
                            </button>
                        ) : (
                            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
                                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>
                                    출금 신청이 진행 중에는 정산정보를 변경할 수 없습니다. 신청을 취소하거나 처리
                                    완료 후 변경해 주세요.
                                </span>
                            </p>
                        )}
                    </>
                ) : (
                    <form onSubmit={submitProfile} className="space-y-3">
                        <Field label="사업자 유형" required>
                            <select
                                value={form.business_type}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, business_type: e.target.value as BusinessType }))
                                }
                                className={inputClass}
                            >
                                <option value="">선택해 주세요</option>
                                <option value="individual">개인(비사업자)</option>
                                <option value="sole_proprietor">개인사업자</option>
                                <option value="corporation">법인</option>
                                <option value="foreigner">외국인</option>
                            </select>
                        </Field>

                        {bt === "individual" ? (
                            <Field label="주민등록번호" required hint="숫자만 입력하세요. 암호화해서 보관합니다.">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={14}
                                    autoComplete="off"
                                    value={form.resident_number}
                                    onChange={(e) => setForm((p) => ({ ...p, resident_number: e.target.value }))}
                                    className={inputClass}
                                />
                            </Field>
                        ) : null}

                        {bt === "sole_proprietor" ? (
                            <>
                                <Field label="사업자등록번호" required hint="숫자만 입력하세요.">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={12}
                                        value={form.business_number}
                                        onChange={(e) => setForm((p) => ({ ...p, business_number: e.target.value }))}
                                        className={inputClass}
                                    />
                                </Field>
                                <Field label="상호" required>
                                    <input
                                        type="text"
                                        maxLength={50}
                                        value={form.company_name_sole}
                                        onChange={(e) => setForm((p) => ({ ...p, company_name_sole: e.target.value }))}
                                        className={inputClass}
                                    />
                                </Field>
                            </>
                        ) : null}

                        {bt === "corporation" ? (
                            <>
                                <Field label="법인등록번호" required hint="숫자만 입력하세요. 암호화해서 보관합니다.">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={13}
                                        autoComplete="off"
                                        value={form.corp_number}
                                        onChange={(e) => setForm((p) => ({ ...p, corp_number: e.target.value }))}
                                        className={inputClass}
                                    />
                                </Field>
                                <Field label="상호" required>
                                    <input
                                        type="text"
                                        maxLength={50}
                                        value={form.company_name_corp}
                                        onChange={(e) => setForm((p) => ({ ...p, company_name_corp: e.target.value }))}
                                        className={inputClass}
                                    />
                                </Field>
                                <Field label="사업자등록번호" hint="있으면 함께 입력해 주세요.">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={12}
                                        value={form.business_number}
                                        onChange={(e) => setForm((p) => ({ ...p, business_number: e.target.value }))}
                                        className={inputClass}
                                    />
                                </Field>
                            </>
                        ) : null}

                        {bt === "foreigner" ? (
                            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                                외국인 링커 정산은 별도 안내 예정입니다. 고객센터로 문의해 주세요.
                            </p>
                        ) : null}

                        {bt && bt !== "foreigner" ? (
                            <>
                                <Field label="은행" required>
                                    <input
                                        type="text"
                                        maxLength={30}
                                        value={form.bank_name}
                                        onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))}
                                        className={inputClass}
                                    />
                                </Field>
                                <Field label="계좌번호" required hint="'-' 없이 숫자만 입력하세요.">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={30}
                                        autoComplete="off"
                                        value={form.account_number}
                                        onChange={(e) => setForm((p) => ({ ...p, account_number: e.target.value }))}
                                        className={inputClass}
                                    />
                                </Field>
                                <Field label="예금주" required>
                                    <input
                                        type="text"
                                        maxLength={30}
                                        value={form.account_holder}
                                        onChange={(e) => setForm((p) => ({ ...p, account_holder: e.target.value }))}
                                        className={inputClass}
                                    />
                                </Field>
                            </>
                        ) : null}

                        <div className="flex gap-2 pt-1">
                            <button
                                type="submit"
                                disabled={busy || bt === "foreigner"}
                                className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500"
                            >
                                {busy ? "저장 중..." : "정산정보 저장"}
                            </button>
                            {data.profile ? (
                                <button
                                    type="button"
                                    onClick={() => setEditing(false)}
                                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
                                >
                                    취소
                                </button>
                            ) : null}
                        </div>
                        <p className="text-xs text-slate-400">
                            민감정보는 입력값을 다시 보여주지 않습니다. 수정 시에는 새로 입력해 주세요.
                        </p>
                    </form>
                )}
            </Card>

            {/* 신청 내역 */}
            <Card title="출금 신청 내역" icon={ReceiptText}>
                {data.requests.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">아직 출금 신청 내역이 없습니다.</p>
                ) : (
                    <ul className="space-y-2">
                        {data.requests.map((row) => (
                            <li key={row.uid} className="rounded-2xl border border-slate-200 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <div className="text-sm font-bold text-slate-900">{money(row.amount)}</div>
                                        <div className="mt-0.5 text-xs text-slate-400">{row.requestedAt}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone(row.status)}`}
                                        >
                                            {row.statusLabel}
                                        </span>
                                        {row.canCancel ? (
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => cancelRequest(row.uid)}
                                                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                신청 취소
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                                {row.rejectReason ? (
                                    <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                                        반려 사유: {row.rejectReason}
                                    </p>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            {/* 수수료 원장 */}
            <Card title="수수료 내역" icon={ReceiptText}>
                {data.ledger.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">아직 수수료 내역이 없습니다.</p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {data.ledger.map((row, index) => (
                            <li key={`${row.orderNum}-${index}`} className="flex items-start justify-between gap-3 py-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                            {row.typeLabel}
                                        </span>
                                        {row.welcomeDiscount > 0 ? (
                                            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
                                                웰컴머니 {money(row.welcomeDiscount)}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mt-1 truncate text-xs text-slate-500">
                                        {row.orderNum ? `주문 ${row.orderNum} · ` : ""}
                                        {row.settlementMonth} 정산
                                    </div>
                                    {row.note ? (
                                        <div className="mt-0.5 truncate text-xs text-slate-400">{row.note}</div>
                                    ) : null}
                                </div>
                                <div className="shrink-0 text-right">
                                    <div
                                        className={`text-sm font-bold ${
                                            row.type === "accrual" ? "text-blue-600" : "text-rose-600"
                                        }`}
                                    >
                                        {row.amountLabel}
                                    </div>
                                    <div className="mt-0.5 text-xs text-slate-400">{row.date}</div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
}
