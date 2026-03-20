// src/app/(site)/[tenant]/(app)/order/new/page.tsx
import { redirect } from "next/navigation";

export default async function OrderNewPage({
                                               params,
                                           }: {
    params: Promise<{ tenant: string }>;
}) {
    const { tenant } = await params;

    redirect(`/${tenant}/order`);
}