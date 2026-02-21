// src/app/(site)/[tenant]/(app)/order/new/page.tsx
import { redirect } from "next/navigation";

export default function OrderNewPage({
                                         params,
                                     }: {
    params: { tenant: string };
}) {
    // ✅ MVP: new는 order로 합칩니다.
    redirect(`/${params.tenant}/order`);
}