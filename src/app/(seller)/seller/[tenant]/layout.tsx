import type { ReactNode } from "react";

export default function SellerTenantLayout({
                                               children,
                                           }: {
    children: ReactNode;
}) {
    return (
        <div className="min-h-dvh bg-gray-50">
            <div className="mx-auto max-w-md p-4">
                <div className="rounded-2xl border bg-white p-3 text-sm font-semibold">
                    셀러 영역
                </div>
            </div>
            <div className="mx-auto max-w-md">{children}</div>
        </div>
    );
}