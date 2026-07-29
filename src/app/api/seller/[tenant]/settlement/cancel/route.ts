// src/app/api/seller/[tenant]/settlement/cancel/route.ts
// 대기 중 출금 신청 취소 프록시.
import { NextRequest } from "next/server";
import { proxyLinkerProducts } from "@/lib/seller/linkerProductsProxy";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ tenant: string }> | { tenant: string } },
) {
    const { tenant } = await Promise.resolve(context.params);
    return proxyLinkerProducts(request, String(tenant ?? ""), "/v1/seller/settlement/cancel", "정산");
}
