// src/app/(seller)/seller/[tenant]/tenants/new/page.tsx
import SellerTenantFormClient from "@/components/seller/SellerTenantFormClient";

export const dynamic = "force-dynamic";

export default function SellerTenantNewPage() {
    return <SellerTenantFormClient mode="new" />;
}
