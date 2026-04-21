// src/app/(seller)/seller/[tenant]/layout.tsx
import { cookies } from "next/headers";
import SellerShell from "@/components/seller/SellerShell";
import SellerNoAccess from "@/components/seller/SellerNoAccess";

function getInternalOrigin() {
    return (
        process.env.NEXT_INTERNAL_ORIGIN ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://127.0.0.1:3000"
    );
}

const GLOBAL_ADMIN_ROLES = ["hq_admin", "hq_staff", "hq_super"];
const SUPER_ADMIN_ROLE = "hq_super";

type AccessCheckResponse = {
    ok: boolean;
    status?: string;
    role?: string;
    message?: string;
};

type SuperCheckResponse = {
    ok: boolean;
    isSuperAdmin?: boolean;
};

async function getCookieString() {
    const store = await cookies();
    return store
        .getAll()
        .map((item) => `${item.name}=${item.value}`)
        .join("; ");
}

async function fetchAccessCheck(tenant: string): Promise<AccessCheckResponse> {
    const origin = getInternalOrigin();
    const url = new URL(`/api/seller/${tenant}/access-check`, origin);
    const cookie = await getCookieString();

    try {
        const res = await fetch(url.toString(), {
            method: "GET",
            cache: "no-store",
            headers: { cookie, "x-tenant-slug": tenant, accept: "application/json" },
        });

        const data = (await res.json().catch(() => null)) as AccessCheckResponse | null;
        return data ?? { ok: false };
    } catch {
        return { ok: false };
    }
}

async function fetchSuperCheck(tenant: string): Promise<SuperCheckResponse> {
    const origin = getInternalOrigin();
    const url = new URL(`/api/seller/${tenant}/super-check`, origin);
    const cookie = await getCookieString();

    try {
        const res = await fetch(url.toString(), {
            method: "GET",
            cache: "no-store",
            headers: { cookie, "x-tenant-slug": tenant, accept: "application/json" },
        });

        const data = (await res.json().catch(() => null)) as SuperCheckResponse | null;
        return data ?? { ok: false };
    } catch {
        return { ok: false };
    }
}

export default async function SellerTenantLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ tenant: string }> | { tenant: string };
}) {
    const resolved = await Promise.resolve(params);
    const tenant = String(resolved?.tenant ?? "").trim();

    if (!tenant) {
        return <div className="p-6">tenant 정보가 없습니다.</div>;
    }

    // "__all__" 전체 지점 뷰: super-check만으로 접근 제어
    if (tenant === "__all__") {
        const superCheck = await fetchSuperCheck("__all__");
        if (!superCheck.isSuperAdmin) {
            return (
                <SellerShell tenant={tenant} isAdmin={false} isSuperAdmin={false} role="">
                    <SellerNoAccess tenant={tenant} />
                </SellerShell>
            );
        }
        return (
            <SellerShell tenant={tenant} isAdmin={true} isSuperAdmin={true} role={SUPER_ADMIN_ROLE}>
                {children}
            </SellerShell>
        );
    }

    const access = await fetchAccessCheck(tenant);
    const role = access.role ?? "";
    const isAdmin = GLOBAL_ADMIN_ROLES.includes(role);
    const isSuperAdmin = role === SUPER_ADMIN_ROLE;

    // access-check 자체가 실패(네트워크 오류, API 다운 등)한 경우 —
    // 개별 페이지 가드에 위임하여 API 장애가 전체 셀러 잠금으로 전파되지 않도록 함
    if (!access.ok) {
        return (
            <SellerShell tenant={tenant} isAdmin={false} isSuperAdmin={false} role="">
                {children}
            </SellerShell>
        );
    }

    // pending / rejected: 권한 안내 화면
    if (access.status !== "active") {
        return (
            <SellerShell tenant={tenant} isAdmin={false} isSuperAdmin={false} role="">
                <SellerNoAccess tenant={tenant} />
            </SellerShell>
        );
    }

    return (
        <SellerShell tenant={tenant} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} role={role}>
            {children}
        </SellerShell>
    );
}
