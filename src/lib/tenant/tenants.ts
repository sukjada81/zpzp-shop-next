// src/lib/tenant/tenants.ts

export type TenantItem = {
    slug: string;      // a, b, c...
    name: string;      // 표시명
    desc?: string;     // 설명
};

/**
 * ✅ MVP: 우선 하드코딩 목록
 * - 나중에 Node API에서 tenants 테이블 조회로 교체
 * - env로 관리하고 싶으면 NEXT_PUBLIC_TENANTS="a,b,c"로 확장 가능
 */
export function getTenantList(): TenantItem[] {
    const env = process.env.NEXT_PUBLIC_TENANTS;
    if (env && env.trim()) {
        return env
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((slug) => ({
                slug,
                name: `${slug.toUpperCase()} 지점`,
                desc: "가맹점 전용 공동구매",
            }));
    }

    return [
        { slug: "a", name: "A 지점", desc: "가맹점 전용 공동구매" },
        { slug: "b", name: "B 지점", desc: "가맹점 전용 공동구매" },
    ];
}