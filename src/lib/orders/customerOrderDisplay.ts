export function toneByOrderStatus(statusLabel: string): string {
    const label = String(statusLabel ?? "");

    if (label.includes("취소")) {
        return "bg-rose-50 border-rose-200 text-rose-700";
    }
    if (label.includes("입금대기")) {
        return "bg-amber-50 border-amber-200 text-amber-800";
    }
    if (label.includes("결제완료") || label.includes("배송완료") || label.includes("구매확정")) {
        return "bg-emerald-50 border-emerald-200 text-emerald-700";
    }
    if (label.includes("배송준비") || label.includes("배송중")) {
        return "bg-sky-50 border-sky-200 text-sky-700";
    }
    if (label.includes("교환") || label.includes("반품")) {
        return "bg-violet-50 border-violet-200 text-violet-700";
    }
    return "bg-slate-50 border-slate-200 text-slate-700";
}
