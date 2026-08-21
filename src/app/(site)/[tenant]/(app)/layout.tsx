import type { Metadata } from "next";
import { headers } from "next/headers";
import AppShellClient from "@/components/layout/AppShellClient";
import { endpoints } from "@/lib/api/endpoints";

function normalizeTenant(raw: string) {
    const t = (raw || "").trim().toLowerCase();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
}

function getInternalOrigin() {
    return (
        process.env.NEXT_INTERNAL_ORIGIN ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://127.0.0.1:3000"
    );
}

type TenantInfoResponse = {
    ok: boolean;
    item?: {
        id: number;
        slug: string;
        name: string;
        primaryDomain?: string | null;
        timezone?: string | null;
        status?: string;
        openchatUrl?: string | null;
    };
};

type TenantInfo = { name: string; primaryDomain: string | null };

async function fetchTenantInfo(tenant: string): Promise<TenantInfo> {
    if (!tenant) return { name: "", primaryDomain: null };
    try {
        const url = new URL(endpoints.publicTenant(tenant), getInternalOrigin());
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (res.ok) {
            const data = (await res.json()) as TenantInfoResponse;
            return {
                name: data?.item?.name?.trim() || "",
                primaryDomain: data?.item?.primaryDomain ?? null,
            };
        }
    } catch {}
    return { name: "", primaryDomain: null };
}

function buildMetadataBase(tenant: string, primaryDomain: string | null): URL {
    if (primaryDomain) {
        return new URL(`https://${primaryDomain}`);
    }
    const baseDomain = process.env.TENANT_BASE_DOMAIN || "zpzp.kr";
    const isDev = process.env.NODE_ENV === "development";
    const port = isDev ? `:${process.env.NEXT_PUBLIC_LOCAL_TENANT_PORT || "3000"}` : "";
    const protocol = isDev ? "http" : "https";
    return new URL(`${protocol}://${tenant}.${baseDomain}${port}`);
}

/**
 * 실제 접속 호스트. 링커 스토어는 미들웨어가 /hq 로 rewrite 하므로 route 의 tenant 만 보면
 * 전부 본사몰로 보인다. 공유 링크(og:url)는 반드시 사용자가 실제로 연 주소여야 한다 —
 * 안 그러면 링커 링크를 카톡에 공유해도 미리보기가 본사 주소로 뜨고, 거기서 열면
 * zpzp_ref 귀속이 안 잡힌다.
 */
async function getRequestHost(): Promise<string> {
    try {
        const h = await headers();
        const raw = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim().toLowerCase();
        return raw.replace(/:\d+$/, "");
    } catch {
        return "";
    }
}

/** 호스트의 서브도메인 라벨. sue.zpzp.kr → "sue". 베이스 도메인이 아니면 "". */
function hostLabel(host: string): string {
    const baseDomain = (process.env.TENANT_BASE_DOMAIN || "zpzp.kr").toLowerCase();
    if (!host || host === baseDomain) return "";
    return host.endsWith(`.${baseDomain}`) ? host.slice(0, -(baseDomain.length + 1)) : "";
}

/** 접속 호스트가 링커 스토어면 그 샵 이름. 아니면 null. 실패는 비치명(본사 표기로 폴백). */
async function fetchLinkerName(label: string): Promise<string | null> {
    if (!label) return null;
    try {
        const url = new URL(endpoints.resolveSlug(label), getInternalOrigin());
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) return null;
        const data = (await res.json()) as { kind?: string; linkerName?: string | null };
        if (data?.kind !== "linker") return null;
        return (data.linkerName ?? "").trim() || label;
    } catch {
        return null;
    }
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ tenant: string }> | { tenant: string };
}): Promise<Metadata> {
    const resolved = await Promise.resolve(params);
    const tenant = normalizeTenant(resolved?.tenant || "");
    const { name: tenantName, primaryDomain } = await fetchTenantInfo(tenant);

    const host = await getRequestHost();
    const linkerName = await fetchLinkerName(hostLabel(host));

    // 공유 URL 은 실제 접속 호스트 기준이다. 호스트를 못 읽은 경우에만 테넌트 기준으로 폴백한다.
    const metadataBase = host
        ? new URL(`https://${host}`)
        : buildMetadataBase(tenant, primaryDomain);
    const canonicalUrl = metadataBase.origin + "/";

    // DAD 잔재 정리 — 표시 브랜드는 "줍줍링크"로 통일(원본: "디스카운트 올데이")
    // 링커 스토어면 그 링커 이름을 앞세운다. 공유받은 사람이 누구의 샵인지 바로 알게.
    const title = linkerName
        ? `${linkerName}의 줍줍샵`
        : tenantName
            ? `줍줍링크 - ${tenantName}`
            : "줍줍링크";
    const description = linkerName
        ? `${linkerName}의 줍줍샵 | 365일 초특가 할인매장`
        : tenantName
            ? `${tenantName} | 365일 초특가 할인매장`
            : "365일 초특가 할인매장";

    return {
        metadataBase,
        title,
        description,
        icons: { icon: "/favicon.ico" },
        alternates: { canonical: canonicalUrl },
        openGraph: {
            title,
            description,
            url: canonicalUrl,
            siteName: "줍줍링크",
            type: "website",
            images: [{ url: "/og_image.jpg", width: 1200, height: 630, alt: "줍줍링크" }],
        },
    };
}

export default async function AppLayout({
                                            children,
                                            params,
                                        }: {
    children: React.ReactNode;
    params: Promise<{ tenant: string }> | { tenant: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = normalizeTenant(resolved?.tenant || "");

    const { name: tenantName } = await fetchTenantInfo(tenant);

    return (
        <AppShellClient tenant={tenant} tenantName={tenantName}>
            {children}
        </AppShellClient>
    );
}