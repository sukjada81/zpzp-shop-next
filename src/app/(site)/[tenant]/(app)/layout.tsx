// src/app/(site)/[tenant]/(app)/layout.tsx
import AppShellClient from "@/components/layout/AppShellClient";

export default function AppLayout({
                                      children,
                                      params,
                                  }: {
    children: React.ReactNode;
    params: { tenant: string };
}) {
    const { tenant } = params;

    // ✅ (app) 그룹 안의 모든 페이지는 AppShellClient를 통해 공통 헤더/드로어를 유지
    // ✅ (auth) 그룹은 별도 layout에서 헤더 제외 가능
    return <AppShellClient tenant={tenant}>{children}</AppShellClient>;
}