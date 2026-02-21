import AppShellClient from "../../../../components/layout/AppShellClient";

export default async function AppLayout(props: {
    children: React.ReactNode;
    params: Promise<{ tenant: string }>;
}) {
    const { tenant } = await props.params;
    return <AppShellClient tenant={tenant}>{props.children}</AppShellClient>;
}