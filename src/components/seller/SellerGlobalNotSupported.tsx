// src/components/seller/SellerGlobalNotSupported.tsx
import { BarChart3 } from "lucide-react";

export default function SellerGlobalNotSupported({ pageLabel }: { pageLabel: string }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-white p-12 text-center shadow-sm">
            <BarChart3 className="mb-4 h-10 w-10 text-slate-300" />
            <p className="text-base font-semibold text-slate-700">
                {pageLabel}은 지점을 선택해야 이용할 수 있습니다.
            </p>
            <p className="mt-1 text-sm text-slate-400">
                상단 스위처에서 특정 지점을 선택한 뒤 다시 확인해주세요.
            </p>
        </div>
    );
}
