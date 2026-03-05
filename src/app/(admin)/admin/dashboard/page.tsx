// src/app/(admin)/admin/dashboard/page.tsx
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation"; // ✅ 추가

type Money = number | string;

type Dash = {
    ok: boolean;
    tenant: string;
    kpi: {
        ordersCount: number;
        productsCount: number;
        totalSales: Money;
        pointsSum: number;
    };
    recentOrders: Array<{
        id: string | number;
        orderNo: string;
        buyerName: string;
        buyerPhone: string;
        status: string;
        paymentStatus: string;
        totalAmount: Money;
        createdAt: string;
        tenant: { slug: string; name: string };
    }>;
};

async function getOriginAndCookie() {
    const h: any = await Promise.resolve(headers() as any);

    const xfProto = (h?.get?.("x-forwarded-proto") || "").split(",")[0].trim();
    const xfHost = (h?.get?.("x-forwarded-host") || "").split(",")[0].trim();
    const host = (h?.get?.("host") || "localhost:3000").trim();

    const proto = xfProto || "http";
    const hostname = xfHost || host;

    const origin = `${proto}://${hostname}`;
    const cookie = (h?.get?.("cookie") || "").toString();

    return { origin, cookie };
}

async function getDash(tenant: string): Promise<Dash> {
    const { origin, cookie } = await getOriginAndCookie();

    const url = new URL(`/api/admin/dashboard`, origin);
    url.searchParams.set("tenant", tenant || "all");

    const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: cookie ? { cookie } : undefined,
    });

    // ✅ 401이면 에러 throw 대신 로그인으로 이동
    if (res.status === 401) {
        redirect(`/login?returnTo=${encodeURIComponent("/dashboard?tenant=" + (tenant || "all"))}`);
    }

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`ADMIN_DASH_FETCH_FAILED:${res.status}:${text || "null"}`);
    }

    return res.json();
}

export default async function AdminDashboardPage({
                                                     searchParams,
                                                 }: {
    searchParams: { tenant?: string };
}) {
    const tenant = searchParams?.tenant || "all";
    const data = await getDash(tenant);

    return (
        <div className="space-y-4">
            {/* 이하 기존 코드 그대로 */}
            <div className="dad-card p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                        <div className="text-lg font-extrabold text-[var(--dad-ink)]">대시보드</div>
                        <div className="text-sm font-bold text-[var(--dad-muted)]">
                            통합 관리자 / tenant 기준으로 데이터가 분기됩니다.
                        </div>
                    </div>

                    <div className="sm:ml-auto flex items-center gap-2">
                        <FilterPill active={tenant === "all"} href="/dashboard?tenant=all" label="전체" />
                        <FilterPill active={tenant === "a"} href="/dashboard?tenant=a" label="A 지점" />
                        <FilterPill active={tenant === "b"} href="/dashboard?tenant=b" label="B 지점" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi title="주문 수" value={data?.kpi?.ordersCount ?? 0} />
                <Kpi title="상품 수" value={data?.kpi?.productsCount ?? 0} />
                <Kpi title="총 매출" value={Number(data?.kpi?.totalSales ?? 0).toLocaleString()} suffix="원" />
                <Kpi title="포인트 합계" value={Number(data?.kpi?.pointsSum ?? 0).toLocaleString()} suffix="P" />
            </div>

            <div className="dad-card p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-extrabold text-[var(--dad-ink)]">최근 주문</div>
                        <div className="text-xs font-bold text-[var(--dad-muted)]">최근 20건</div>
                    </div>
                    <Link
                        href="/orders"
                        className="rounded-full border border-[var(--dad-border)] bg-white/70 px-4 py-2 text-sm font-extrabold text-[var(--dad-ink)]"
                    >
                        주문 전체보기 →
                    </Link>
                </div>

                <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-sm">
                        <thead>
                        <tr className="border-b border-[var(--dad-border)] text-xs font-extrabold text-[var(--dad-muted)]">
                            <th className="py-3 pr-3">지점</th>
                            <th className="py-3 pr-3">주문번호</th>
                            <th className="py-3 pr-3">구매자</th>
                            <th className="py-3 pr-3">상태</th>
                            <th className="py-3 pr-3">결제</th>
                            <th className="py-3 pr-3 text-right">금액</th>
                            <th className="py-3 pr-3">일시</th>
                        </tr>
                        </thead>
                        <tbody>
                        {(data?.recentOrders || []).map((o) => (
                            <tr key={String(o.id)} className="border-b border-[var(--dad-border)]">
                                <td className="py-3 pr-3 font-bold text-[var(--dad-ink)]">
                                    {o.tenant?.name} ({o.tenant?.slug})
                                </td>
                                <td className="py-3 pr-3 font-extrabold text-[var(--dad-ink)]">{o.orderNo}</td>
                                <td className="py-3 pr-3">
                                    <div className="font-bold text-[var(--dad-ink)]">{o.buyerName}</div>
                                    <div className="text-xs font-bold text-[var(--dad-muted)]">{o.buyerPhone}</div>
                                </td>
                                <td className="py-3 pr-3">
                                    <Badge>{o.status}</Badge>
                                </td>
                                <td className="py-3 pr-3">
                                    <Badge>{o.paymentStatus}</Badge>
                                </td>
                                <td className="py-3 pr-3 text-right font-extrabold text-[var(--dad-ink)]">
                                    {Number(o.totalAmount ?? 0).toLocaleString()}원
                                </td>
                                <td className="py-3 pr-3 text-xs font-bold text-[var(--dad-muted)]">
                                    {new Date(o.createdAt).toLocaleString("ko-KR")}
                                </td>
                            </tr>
                        ))}

                        {(data?.recentOrders || []).length === 0 && (
                            <tr>
                                <td colSpan={7} className="py-8 text-center text-sm font-bold text-[var(--dad-muted)]">
                                    주문 데이터가 없습니다.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
    return (
        <a
            href={href}
            className={[
                "rounded-full px-4 py-2 text-sm font-extrabold",
                active
                    ? "bg-[var(--dad-orange)] text-white shadow-sm"
                    : "border border-[var(--dad-border)] bg-white/70 text-[var(--dad-ink)]",
            ].join(" ")}
        >
            {label}
        </a>
    );
}

function Kpi({ title, value, suffix }: { title: string; value: string | number; suffix?: string }) {
    return (
        <div className="dad-card p-5">
            <div className="text-xs font-extrabold text-[var(--dad-muted)]">{title}</div>
            <div className="mt-2 text-2xl font-extrabold text-[var(--dad-ink)]">
                {value}
                {suffix ? <span className="ml-1 text-base font-extrabold text-[var(--dad-muted)]">{suffix}</span> : null}
            </div>
        </div>
    );
}

function Badge({ children }: { children: ReactNode }) {
    return (
        <span className="inline-flex items-center rounded-full border border-[var(--dad-border)] bg-white/70 px-3 py-1 text-xs font-extrabold text-[var(--dad-ink)]">
      {children}
    </span>
    );
}